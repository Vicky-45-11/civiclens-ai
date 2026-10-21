"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, Crosshair, ImagePlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { shrinkPhoto } from "@/lib/image";
import { CATEGORIES, SEVERITY_LABEL, categoryLabel } from "@/lib/labels";
import type { Category, Duplicate, Preview } from "@/lib/types";
import type { IssueDetail } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { MapView } from "@/components/MapView";
import { ErrorBox, NeedSignIn, PageTitle, Spinner, SeverityPill } from "@/components/ui";

const MAX_PHOTOS = 4;
const MAX_BYTES = 6 * 1024 * 1024;
const STEPS = ["Photos", "Location", "Details", "Review"];

export default function ReportPage() {
  const { user, loading } = useAuth();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [category, setCategory] = useState<Category | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hint, setHint] = useState("");
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [done, setDone] = useState<IssueDetail | null>(null);

  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);

  if (loading) return <Spinner />;
  if (!user) return <NeedSignIn next="/report" />;
  if (done) return <Success issue={done} />;

  async function addFiles(list: File[]) {
    setError(null);
    const next = [...files];
    for (const f of list) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError(`${f.name}: only JPEG, PNG or WebP photos are accepted.`);
      if (next.length >= MAX_PHOTOS) break;
      const small = await shrinkPhoto(f);
      if (small.size > MAX_BYTES) return setError(`${f.name} is larger than 6 MB.`);
      next.push(small);
    }
    setFiles(next);
  }

  function locate() {
    setGeoMsg(null);
    if (!navigator.geolocation) return setGeoMsg("Your browser cannot share its location. Tap the map instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => setPoint([p.coords.latitude, p.coords.longitude]),
      () => setGeoMsg("We could not get your location. Allow location access, or tap the map to place the pin."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const form = () => {
    const f = new FormData();
    files.forEach((file) => f.append("photos", file));
    f.set("lat", String(point![0]));
    f.set("lon", String(point![1]));
    return f;
  };

  async function toReview() {
    setBusy(true);
    setError(null);
    try {
      const f = form();
      if (category) f.set("category", category);
      setPreview(await api.upload<Preview>("/issues/preview", f));
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const f = form();
      f.set("category", category);
      f.set("title", title);
      f.set("description", description);
      if (hint) f.set("address_hint", hint);
      const res = await api.upload<{ issue: IssueDetail }>("/issues", f);
      setDone(res.issue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the report.");
    } finally {
      setBusy(false);
    }
  }

  const canNext = [files.length > 0, point !== null, category !== "" && title.trim().length >= 3, consent][step];

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="New report" title="Report an issue">
        Four short steps. Nothing is public until a person has reviewed it.
      </PageTitle>
      <ol className="mb-6 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-bold sm:text-sm ${i === step ? "bg-civic text-white" : i < step ? "bg-civic-light text-civic-dark" : "bg-white text-ink-mute ring-1 ring-line"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="card p-5">
        {step === 0 && (
          <div>
            <h2 className="text-2xl">Add photos</h2>
            <p className="mt-1 text-sm text-ink-soft">Up to {MAX_PHOTOS} photos, 6 MB each. Please avoid faces, number plates and the inside of homes. Location data hidden in the photo is removed when it is uploaded.</p>
            <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-paper p-6 text-center hover:border-civic">
              <ImagePlus className="h-8 w-8 text-civic" aria-hidden="true" />
              <span className="font-semibold">Take or choose a photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  void addFiles(picked);
                  e.target.value = "";
                }} />
            </label>
            {files.length === 0 ? (
              <p className="mt-3 text-sm text-ink-mute">No photos yet.</p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a file the visitor just chose */}
                    <img src={urls[i]} alt={`Selected photo ${i + 1}`} className="h-28 w-full rounded-lg object-cover" />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} className="absolute right-1 top-1 rounded-full bg-white p-2 shadow" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-2xl">Where is it?</h2>
            <p className="mt-1 text-sm text-ink-soft">Tap the map to drop the pin, drag it to adjust, or use your current location.</p>
            <button type="button" className="btn-secondary mt-3" onClick={locate}>
              <Crosshair className="h-4 w-4" aria-hidden="true" /> Use my location
            </button>
            {geoMsg && <p className="mt-2 text-sm text-[#7c2a1f]">{geoMsg}</p>}
            <div className="mt-3 overflow-hidden rounded-xl">
              <MapView height="340px" picker={{ value: point, onChange: setPoint }} />
            </div>
            <p className="mt-2 text-sm text-ink-mute">{point ? `Pin at ${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : "No pin placed yet."}</p>
            <label className="label mt-3" htmlFor="hint">
              Landmark or address hint (optional)
            </label>
            <input id="hint" className="field" value={hint} maxLength={200} onChange={(e) => setHint(e.target.value)} placeholder="Opposite the bus stop" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl">Describe it</h2>
            <fieldset>
              <legend className="label">What kind of problem is it?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((c) => (
                  <label key={c.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 ${category === c.id ? "border-civic bg-civic-light" : "border-line bg-white"}`}>
                    <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} className="h-4 w-4 accent-[#0f6e68]" />
                    <span>
                      <span className="block font-semibold">{c.label}</span>
                      <span className="block text-xs text-ink-mute">{c.blurb}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="title">
                Short title
              </label>
              <input id="title" className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Deep pothole outside the school gate" />
            </div>
            <div>
              <label className="label" htmlFor="desc">
                Details (optional)
              </label>
              <textarea id="desc" className="field min-h-28" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} placeholder="How big is it? Is it dangerous? How long has it been there?" />
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-5">
            <h2 className="text-2xl">Check and send</h2>
            <section aria-labelledby="ai-h" className="rounded-xl bg-paper p-4">
              <h3 id="ai-h" className="text-lg">
                AI suggestion {preview.ai.is_demo && <span className="chip ml-2 bg-signal-light text-[#7a4a0c]">Demo mode</span>}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{preview.ai.note}</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-ink-mute">Category</dt>
                  <dd>
                    {preview.ai.category ? categoryLabel(preview.ai.category) : "Not detected"}
                    {preview.ai.confidence !== null && <span className="text-ink-mute"> ({Math.round(preview.ai.confidence * 100)}% confidence)</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-ink-mute">Severity suggestion</dt>
                  <dd>
                    <SeverityPill value={preview.ai.severity} suggested /> <span className="text-xs text-ink-mute">({SEVERITY_LABEL[preview.ai.severity]}; staff decide the real level)</span>
                  </dd>
                </div>
              </dl>
              {preview.ai.category && category && preview.ai.category !== category && (
                <p className="mt-3 rounded-lg bg-signal-light p-3 text-sm">
                  The model suggests <strong>{categoryLabel(preview.ai.category)}</strong>, you chose <strong>{categoryLabel(category)}</strong>.{" "}
                  <button type="button" className="font-semibold underline" onClick={() => setCategory(preview.ai.category as Category)}>
                    Use the suggestion
                  </button>
                </p>
              )}
            </section>
            <Duplicates items={preview.duplicates} />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0f6e68]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-sm">
                I confirm the photos do not show identifiable people or number plates, and I understand a moderator reviews this report before it is published.{" "}
                <Link href="/about" className="font-semibold text-civic underline" target="_blank">
                  Privacy details
                </Link>
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between gap-3">
        <button type="button" className="btn-secondary" disabled={step === 0 || busy} onClick={() => (setStep(step - 1), setError(null))}>
          Back
        </button>
        {step < 2 && (
          <button type="button" className="btn-primary" disabled={!canNext} onClick={() => (setStep(step + 1), setError(null))}>
            Continue
          </button>
        )}
        {step === 2 && (
          <button type="button" className="btn-primary" disabled={!canNext || busy} onClick={toReview}>
            {busy ? "Checking photo…" : "Review"}
          </button>
        )}
        {step === 3 && (
          <button type="button" className="btn-primary" disabled={!canNext || busy} onClick={submit}>
            <Camera className="h-4 w-4" aria-hidden="true" /> {busy ? "Sending…" : "Send report"}
          </button>
        )}
      </div>
    </div>
  );
}

function Duplicates({ items }: { items: Duplicate[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-soft">We found no similar open report within about 60 metres.</p>;
  return (
    <section aria-labelledby="dup-h" className="rounded-xl border border-[#e6c58f] bg-signal-light p-4">
      <h3 id="dup-h" className="flex items-center gap-2 text-lg">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Similar reports nearby
      </h3>
      <p className="text-sm">If one of these is the same problem, you do not need to report it again. You can still send yours; staff will merge duplicates.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((d) => (
          <li key={d.id}>
            <Link className="font-semibold underline" href={`/issues/${d.id}`} target="_blank">
              {d.title}
            </Link>{" "}
            ({d.tracking_code}, {Math.round(d.distance_m)} m away{d.likely ? ", likely the same" : ""})
          </li>
        ))}
      </ul>
    </section>
  );
}

function Success({ issue }: { issue: IssueDetail }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-3xl">Report received</h1>
      <p className="mt-2 text-ink-soft">A person will review it before it is published. Keep this code to follow progress:</p>
      <p className="my-4 font-display text-4xl tracking-wider text-civic">{issue.tracking_code}</p>
      <div className="flex justify-center gap-3">
        <Link className="btn-primary" href={`/issues/${issue.id}`}>
          View report
        </Link>
        <Link className="btn-secondary" href="/my">
          My reports
        </Link>
      </div>
      <p className="mt-4 text-xs text-ink-mute">Reports are not sent to any government body by CivicLens itself.</p>
    </div>
  );
}

