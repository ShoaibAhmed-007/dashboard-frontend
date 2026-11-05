import type { TaskSearchScope } from "@/stores/task-search.store";
import type { TaskSearchParams } from "@/services/task.service";
import type { OverviewPeriod } from "@/services/accounting.service";

export const queryKeys = {
  workspaceMembers: (workspaceId: string | null) =>
    ["workspace-members", workspaceId] as const,
  taskLists: (projectId: string, includeArchived = false) =>
    ["task-lists", projectId, { includeArchived }] as const,
  taskBoardInfinite: (scope: TaskSearchScope, params: TaskSearchParams) =>
    ["task-board-infinite", scope, params] as const,
  taskBoard: (projectId: string, params: TaskSearchParams) =>
    ["task-board", projectId, params] as const,

  universityDashboard: () => ["university", "dashboard"] as const,
  universityCourses: (params: unknown) =>
    ["university", "courses", params] as const,
  universityMyCourses: () => ["university", "my-courses"] as const,
  universityCourseDetail: (courseId: string) =>
    ["university", "course-detail", courseId] as const,
  universityPlaybackSession: (lessonId: string) =>
    ["university", "playback-session", lessonId] as const,
  universityLessonNote: (lessonId: string) =>
    ["university", "lesson-note", lessonId] as const,

  projects: (workspaceId: string | null) =>
    ["projects", workspaceId] as const,
  archivedProjects: (workspaceId: string | null) =>
    ["projects", workspaceId, "archived"] as const,
  projectDashboard: (projectId: string) =>
    ["project-dashboard", projectId] as const,
  /** Members of a PRIVATE project. Readable by any member. */
  projectMembers: (projectId: string) =>
    ["project-members", projectId] as const,
  /** Invite-picker rows. Kept under a separate key from `projectMembers`
   *  because this endpoint is creator-only — sharing a key would let a
   *  non-creator's 403 poison the member list. */
  projectMemberCandidates: (projectId: string) =>
    ["project-member-candidates", projectId] as const,
  /* Workspace-scoped: meetings are per-workspace, and omitting the id would
     serve one workspace's list to another after a switch. */
  moms: (workspaceId: string | null) => ["moms", workspaceId] as const,
  /** OWNER/MANAGER's department-detail screen — a distinct key from `moms`
   *  above so the flat list and one department's list never collide. */
  momsByDepartment: (workspaceId: string | null, departmentId: string) =>
    ["moms", workspaceId, "department", departmentId] as const,
  mom: (meetingId: string) => ["moms", "detail", meetingId] as const,
  /* Same workspace-scoping reasoning as moms above. */
  departments: (workspaceId: string | null, params?: unknown) =>
    ["departments", workspaceId, params] as const,
  department: (departmentId: string) =>
    ["departments", "detail", departmentId] as const,
  profile: () => ["profile"] as const,
  myTasks: (workspaceId: string | null) =>
    ["my-tasks", workspaceId] as const,
  docs: (workspaceId: string | null) => ["docs", workspaceId] as const,
  channels: (workspaceId: string | null) =>
    ["channels", workspaceId] as const,
  favorites: (workspaceId: string | null) =>
    ["favorites", workspaceId] as const,
  statuses: (projectId: string) => ["statuses", projectId] as const,
  tags: (workspaceId: string | null) => ["tags", workspaceId] as const,
  aiConversations: (workspaceId: string | null) =>
    ["ai-conversations", workspaceId] as const,
  aiConversation: (workspaceId: string | null, id: string | null) =>
    ["ai-conversations", workspaceId, id] as const,

  // Accounting — workspace-scoped, like most keys above. The backend moved these
  // modules from one global ledger to per-workspace ledgers, so the workspace id
  // MUST be part of every key: without it, switching workspaces would serve one
  // workspace's ledger while displaying another. All share the "accounting" root
  // so a mutation can invalidate the derived overview by prefix.
  accountingRole: (workspaceId: string | null) =>
    ["accounting", "role", workspaceId] as const,
  accountingOverview: (workspaceId: string | null, period: OverviewPeriod) =>
    ["accounting", "overview", workspaceId, period] as const,
  accountingClients: (workspaceId: string | null, params: unknown) =>
    ["accounting", "clients", workspaceId, params] as const,
  accountingClient: (workspaceId: string | null, clientId: string) =>
    ["accounting", "client", workspaceId, clientId] as const,
  accountingClientSearch: (workspaceId: string | null, q: string) =>
    ["accounting", "client-search", workspaceId, q] as const,
  accountingEmployees: (workspaceId: string | null, params: unknown) =>
    ["accounting", "employees", workspaceId, params] as const,
  accountingEmployee: (workspaceId: string | null, employeeId: string) =>
    ["accounting", "employee", workspaceId, employeeId] as const,
  accountingEmployeeSearch: (workspaceId: string | null, q: string) =>
    ["accounting", "employee-search", workspaceId, q] as const,
  accountingVendors: (workspaceId: string | null, params: unknown) =>
    ["accounting", "vendors", workspaceId, params] as const,
  accountingVendor: (workspaceId: string | null, vendorId: string) =>
    ["accounting", "vendor", workspaceId, vendorId] as const,
  accountingVendorSearch: (workspaceId: string | null, q: string) =>
    ["accounting", "vendor-search", workspaceId, q] as const,
  accountingDashboardSearch: (workspaceId: string | null, q: string) =>
    ["accounting", "dashboard-search", workspaceId, q] as const,
  accountingTransactions: (workspaceId: string | null, params: unknown) =>
    ["accounting", "transactions", workspaceId, params] as const,
  accountingBankAccounts: (workspaceId: string | null, params: unknown) =>
    ["accounting", "bank-accounts", workspaceId, params] as const,
  // Reports keys take their dates as discrete segments rather than a params
  // object — they're scalars, so this gives stable structural equality without
  // the caller needing to memoize an object literal.
  accountingReportsBreakdown: (
    workspaceId: string | null,
    dateFrom: string | null,
    dateTo: string | null
  ) => ["accounting", "reports-breakdown", workspaceId, dateFrom, dateTo] as const,
  accountingDailyReport: (workspaceId: string | null, date: string | null) =>
    ["accounting", "daily-report", workspaceId, date] as const,
  accountingMonthlyBreakdown: (workspaceId: string | null, year: number | null) =>
    ["accounting", "monthly-breakdown", workspaceId, year] as const,

  // IT management — workspace-scoped, same reasoning as accounting above.
  itAssets: (workspaceId: string | null, params: unknown) =>
    ["it-assets", workspaceId, params] as const,
  itAsset: (workspaceId: string | null, assetId: string) =>
    ["it-assets", "detail", workspaceId, assetId] as const,
  itAssetsSummary: (workspaceId: string | null) =>
    ["it-assets", "summary", workspaceId] as const,
  companyEmployees: (workspaceId: string | null, params: unknown) =>
    ["company-employees", workspaceId, params] as const,
  companyEmployee: (workspaceId: string | null, employeeId: string) =>
    ["company-employees", "detail", workspaceId, employeeId] as const,
  itRequests: (workspaceId: string | null, params: unknown) =>
    ["it-requests", workspaceId, params] as const,
  itRequest: (workspaceId: string | null, requestId: string) =>
    ["it-requests", "detail", workspaceId, requestId] as const,
  itRequestsSummary: (workspaceId: string | null) =>
    ["it-requests", "summary", workspaceId] as const,
  itBills: (workspaceId: string | null, params: unknown) =>
    ["it-bills", workspaceId, params] as const,
  itBill: (workspaceId: string | null, billId: string) =>
    ["it-bills", "detail", workspaceId, billId] as const,
  itBillsSummary: (workspaceId: string | null) =>
    ["it-bills", "summary", workspaceId] as const,
  itDashboardOverview: (workspaceId: string | null) =>
    ["it-dashboard", "overview", workspaceId] as const,
} as const;

/** Root key for every accounting query — used for prefix invalidation. */
export const ACCOUNTING_ROOT_KEY = "accounting" as const;
