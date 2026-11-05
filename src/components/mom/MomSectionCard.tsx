"use client";

/** One numbered step of the Create form: "01 Meeting information", etc. */
export default function MomSectionCard({
  step,
  title,
  description,
  children,
}: {
  /** Rendered as-is, so the caller controls the zero padding ("01"). */
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-500 dark:bg-brand-500/10"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}
