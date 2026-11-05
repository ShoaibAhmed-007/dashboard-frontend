import { LuCircleDollarSign } from "react-icons/lu";

const COST_ITEMS = [
  {
    label: "Dashboard AI chat",
    model: "gpt-4o-mini",
    basis: "≈ $0.15 / 1M input tokens + $0.60 / 1M output tokens",
  },
  {
    label: "Image generation",
    model: "gpt-image-1",
    basis: "Billed at the OpenAI image-generation rate per generated image",
  },
  {
    label: "Document generation",
    model: "gpt-4o-mini",
    basis: "Draft content step only; the PDF render happens on the backend",
  },
  {
    label: "PPTX generation",
    model: "gpt-4o-mini",
    basis: "Draft content step only; the PPTX render happens on the backend",
  },
];

export default function CostUsageSummary() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <LuCircleDollarSign className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Cost basis
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Dashboard AI shows the model rate used for each feature. Actual spend is billed in your OpenAI account.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {COST_ITEMS.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-950/70"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{item.label}</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                {item.model}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-5 text-gray-500 dark:text-gray-400">{item.basis}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
