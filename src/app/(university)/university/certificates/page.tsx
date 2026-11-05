import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Certificates | Dashboard University",
};

export default function CertificatesPage() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[
          { title: "Information Security Essentials", date: "March 2026", tag: "CYBERSECURITY" },
          { title: "Product Thinking for Managers", date: "January 2026", tag: "LEADERSHIP" },
          { title: "Workplace Diversity & Inclusion", date: "November 2025", tag: "HR & CULTURE" },
        ].map((cert) => (
          <div key={cert.title} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="h-32 bg-gradient-to-br from-[#3D1A6E] to-[#7C3AED] flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.6">
                <rect x="8" y="4" width="32" height="32" rx="4" stroke="white" strokeWidth="2"/>
                <path d="M16 20h16M16 26h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="24" cy="36" r="6" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="2"/>
                <path d="M21 36l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 42h8M24 42v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-bold tracking-widest text-[#7C3AED] mb-1">{cert.tag}</p>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{cert.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Completed {cert.date}</p>
              <button className="w-full rounded-lg border border-[#7C3AED] px-3 py-2 text-xs font-medium text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors">
                Download Certificate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
