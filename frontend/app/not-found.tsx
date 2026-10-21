import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-3xl">Page not found</h1>
      <p className="mt-2 text-ink-soft">That page does not exist, or the report is not public.</p>
      <Link href="/" className="btn-primary mt-4">
        Back to the start
      </Link>
    </div>
  );
}
