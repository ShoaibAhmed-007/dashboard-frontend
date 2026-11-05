import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports | Dashboard University",
};

export default function ReportsPage() {
  const stats = [
    { label: "Completion Rate", value: "78%", sub: "↑ 5% vs last month", color: "text-green-600" },
    { label: "Avg. Score", value: "84", sub: "Quiz average", color: "text-blue-600" },
    { label: "Active Learners", value: "42", sub: "Out of 48 enrolled", color: "text-purple-600" },
    { label: "Hours Logged", value: "312h", sub: "This quarter", color: "text-orange-500" },
  ];

  const topCourses = [
    { title: "Information Security Essentials", completion: 92, enrolled: 48 },
    { title: "Excel & Google Sheets Mastery", completion: 75, enrolled: 32 },
    { title: "Workplace Diversity & Inclusion", completion: 68, enrolled: 44 },
    { title: "Product Thinking for Managers", completion: 60, enrolled: 20 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            <p className={`mt-2 text-xs font-medium ${s.color}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Course Completion Rates</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {topCourses.map((c) => (
            <div key={c.title} className="px-6 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.enrolled} learners enrolled</p>
              </div>
              <div className="w-40 flex items-center gap-3 flex-shrink-0">
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-2 rounded-full bg-[#7C3AED]" style={{ width: `${c.completion}%` }} />
                </div>
                <span className="text-sm font-semibold text-[#7C3AED] w-9 text-right">{c.completion}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
