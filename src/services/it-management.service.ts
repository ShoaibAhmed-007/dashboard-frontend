import { api } from "@/lib/api";
import type {
  Asset,
  AssetListParams,
  AssetsSummary,
  CompanyEmployee,
  CompanyEmployeeListParams,
  CreateAssetPayload,
  CreateCompanyEmployeePayload,
  CreateItBillPayload,
  CreateItRequestPayload,
  DashboardOverview,
  ItBill,
  ItBillListParams,
  ItBillsSummary,
  ItRequest,
  ItRequestListParams,
  ItRequestSummary,
  PaginationMeta,
  UpdateAssetPayload,
  UpdateCompanyEmployeePayload,
  UpdateItBillPayload,
  UpdateItRequestPayload,
  UpdateItRequestStatusPayload,
} from "@/types/it-management";

// ── Envelopes ─────────────────────────────────────────────────────────────
// Same standard envelope as accounting.service.ts: { success, data, message }
// for singles, plus `meta` for paginated lists. `x-workspace-id` is attached
// by the shared axios interceptor — never set it manually here.

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

interface PaginatedApiWrapper<T> extends ApiWrapper<T> {
  meta: PaginationMeta;
}

/** Drops empty values so an unset filter never becomes `?status=` on the wire. */
function serializeParams(
  params?: object
): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const query: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query[key] = value as string | number;
  }
  return query;
}

/** Company-owned hardware/software assets. */
export const assetsService = {
  list: (params?: AssetListParams) =>
    api
      .get<PaginatedApiWrapper<Asset[]>>("/assets", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  /** Per-category totals (`stats`) plus the 6 most recently created assets
   *  (`latestAssets`), for the overview screen's cards and its "recently
   *  added" table before any category is drilled into. */
  summary: () =>
    api
      .get<ApiWrapper<AssetsSummary>>("/assets/summary")
      .then((r) => r.data.data),

  get: (assetId: string) =>
    api.get<ApiWrapper<Asset>>(`/assets/${assetId}`).then((r) => r.data.data),

  create: (payload: CreateAssetPayload) =>
    api.post<ApiWrapper<Asset>>("/assets", payload).then((r) => r.data.data),

  update: (assetId: string, payload: UpdateAssetPayload) =>
    api
      .patch<ApiWrapper<Asset>>(`/assets/${assetId}`, payload)
      .then((r) => r.data.data),

  /** Unconditional — an asset has no dependents to guard against. */
  delete: (assetId: string) => api.delete(`/assets/${assetId}`),
};

/** Accepted by `POST /company-employees/avatar-presign` — mirrors the
 *  server's own EMPLOYEE_AVATAR_ALLOWED_MIME_TYPES / _MAX_FILE_SIZE_BYTES. */
export const EMPLOYEE_AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const EMPLOYEE_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB, enforced server-side too

/**
 * The IT-management "who" directory — distinct from `employeeService` in
 * accounting.service.ts (that one tracks sales commission; this one tracks
 * asset/request ownership). Same word, different backend model.
 */
export const companyEmployeesService = {
  list: (params?: CompanyEmployeeListParams) =>
    api
      .get<PaginatedApiWrapper<CompanyEmployee[]>>("/company-employees", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  get: (employeeId: string) =>
    api
      .get<ApiWrapper<CompanyEmployee>>(`/company-employees/${employeeId}`)
      .then((r) => r.data.data),

  create: (payload: CreateCompanyEmployeePayload) =>
    api
      .post<ApiWrapper<CompanyEmployee>>("/company-employees", payload)
      .then((r) => r.data.data),

  update: (employeeId: string, payload: UpdateCompanyEmployeePayload) =>
    api
      .patch<ApiWrapper<CompanyEmployee>>(
        `/company-employees/${employeeId}`,
        payload
      )
      .then((r) => r.data.data),

  /**
   * Step 1 of the avatar upload — same shape as `bankAccountService.presignLogo`.
   * Sent as multipart/form-data: the backend derives name/mime/size from the
   * bytes itself rather than trusting client-supplied fields.
   */
  presignAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ApiWrapper<{ uploadUrl: string; imageUrl: string; expiresIn: number }>>(
        "/company-employees/avatar-presign",
        form,
        // The axios instance defaults to application/json. Undefined here lets
        // the browser set multipart/form-data with the correct boundary itself
        // — a hardcoded value would omit the boundary and the backend's
        // FileInterceptor would find no file.
        { headers: { "Content-Type": undefined } }
      )
      .then((r) => r.data.data);
  },

  /**
   * Step 2: PUT the raw bytes straight to S3, bypassing this API. `Content-Type`
   * is required — the presigned URL is signed without one, so omitting it makes
   * S3 store the object as application/octet-stream and the avatar downloads
   * instead of rendering.
   */
  uploadAvatarToS3: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Avatar upload failed: ${res.status}`);
  },

  /** Both steps. Returns the permanent public URL to save as `imageUrl` on
   *  create/update — the presign step alone doesn't touch the employee record. */
  uploadAvatar: async (file: File): Promise<string> => {
    const { uploadUrl, imageUrl } = await companyEmployeesService.presignAvatar(file);
    await companyEmployeesService.uploadAvatarToS3(uploadUrl, file);
    return imageUrl;
  },

  /** Clears `assignedToId` on that asset and resets its status to
   *  `AVAILABLE`. The asset itself is not deleted. */
  unlinkAsset: (employeeId: string, assetId: string) =>
    api
      .patch<
        ApiWrapper<CompanyEmployee>
      >(`/company-employees/${employeeId}/assets/${assetId}/unlink`)
      .then((r) => r.data.data),

  /** Unconditional — assets referencing this employee get `assignedToId`
   *  cleared (SET NULL) rather than blocking the delete. */
  delete: (employeeId: string) =>
    api.delete(`/company-employees/${employeeId}`),
};

export const itRequestsService = {
  list: (params?: ItRequestListParams) =>
    api
      .get<PaginatedApiWrapper<ItRequest[]>>("/it-requests", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  /** One entry per `requestType` (HARDWARE, SOFTWARE). */
  summary: () =>
    api
      .get<ApiWrapper<ItRequestSummary[]>>("/it-requests/summary")
      .then((r) => r.data.data),

  get: (requestId: string) =>
    api
      .get<ApiWrapper<ItRequest>>(`/it-requests/${requestId}`)
      .then((r) => r.data.data),

  /** Always created as `REQUESTED` — the server ignores any status sent here. */
  create: (payload: CreateItRequestPayload) =>
    api
      .post<ApiWrapper<ItRequest>>("/it-requests", payload)
      .then((r) => r.data.data),

  /** Non-status fields only — `requestStatus` is rejected by this DTO. */
  update: (requestId: string, payload: UpdateItRequestPayload) =>
    api
      .patch<ApiWrapper<ItRequest>>(`/it-requests/${requestId}`, payload)
      .then((r) => r.data.data),

  /** IT manager/OWNER only. State-machine transition. 400s on an invalid
   *  transition (see {@link UpdateItRequestStatusPayload}'s doc comment for
   *  the graph). */
  updateStatus: (requestId: string, payload: UpdateItRequestStatusPayload) =>
    api
      .patch<
        ApiWrapper<ItRequest>
      >(`/it-requests/${requestId}/status`, payload)
      .then((r) => r.data.data),

  /** Requester-only, and only while the request is still `REQUESTED` — 403
   *  otherwise. No body. Not an IT-manager action. */
  withdraw: (requestId: string) =>
    api
      .patch<ApiWrapper<ItRequest>>(`/it-requests/${requestId}/withdraw`)
      .then((r) => r.data.data),

  /** IT manager/OWNER only. */
  delete: (requestId: string) => api.delete(`/it-requests/${requestId}`),

  /** Step 1 of an attachment upload — same shape/reasoning as
   *  `itBillsService.presignInvoice`. Open to any authenticated member. */
  presignAttachment: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ApiWrapper<{ uploadUrl: string; fileUrl: string; expiresIn: number }>>(
        "/it-requests/attachment-presign",
        form,
        { headers: { "Content-Type": undefined } }
      )
      .then((r) => r.data.data);
  },

  /** Step 2: PUT the raw bytes straight to S3, bypassing this API. */
  uploadAttachmentToS3: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Attachment upload failed: ${res.status}`);
  },

  /** Both steps. Returns `{ url, name }` — append to the `attachments` array
   *  sent on create/update. */
  uploadAttachment: async (file: File): Promise<{ url: string; name: string }> => {
    const { uploadUrl, fileUrl } = await itRequestsService.presignAttachment(file);
    await itRequestsService.uploadAttachmentToS3(uploadUrl, file);
    return { url: fileUrl, name: file.name };
  },
};

/** Accepted by `POST /it-bills/invoice-presign` — mirrors the server's own
 *  allowed mime types / max size for a vendor invoice attachment. */
export const IT_BILL_INVOICE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "video/mp4",
] as const;

export const IT_BILL_INVOICE_MAX_BYTES = 50 * 1024 * 1024; // 50MB, enforced server-side too

/** `GET /it-bills`'s envelope also carries a workspace-wide `summary` block
 *  alongside `data`/`meta` — see doc §6, "summary shape". */
interface ItBillsListApiWrapper {
  success: boolean;
  data: ItBill[];
  meta: PaginationMeta;
  summary: ItBillsSummary;
  message: string | null;
}

/** Vendor invoices — hardware/software purchase bills, tracked separately
 *  from IT Requests (a request becomes a bill once actually purchased, but
 *  nothing here links the two server-side). */
export const itBillsService = {
  /** The `summary` in the response is always workspace-wide, independent of
   *  `params` — it does not reset when filtering to one status tab. */
  list: (params?: ItBillListParams) =>
    api
      .get<ItBillsListApiWrapper>("/it-bills", { params: serializeParams(params) })
      .then((r) => ({ items: r.data.data, meta: r.data.meta, summary: r.data.summary })),

  /** Same numbers as the `summary` embedded in `list()`, as a standalone call. */
  summary: () =>
    api.get<ApiWrapper<ItBillsSummary>>("/it-bills/summary").then((r) => r.data.data),

  get: (billId: string) =>
    api.get<ApiWrapper<ItBill>>(`/it-bills/${billId}`).then((r) => r.data.data),

  /** `status` may only be `PENDING`/`PAID` — the computed values 422. */
  create: (payload: CreateItBillPayload) =>
    api.post<ApiWrapper<ItBill>>("/it-bills", payload).then((r) => r.data.data),

  update: (billId: string, payload: UpdateItBillPayload) =>
    api.patch<ApiWrapper<ItBill>>(`/it-bills/${billId}`, payload).then((r) => r.data.data),

  /** Convenience action: sets `status: PAID` and stamps `paidAt` — no body needed. */
  markPaid: (billId: string) =>
    api.patch<ApiWrapper<ItBill>>(`/it-bills/${billId}/mark-paid`).then((r) => r.data.data),

  delete: (billId: string) => api.delete(`/it-bills/${billId}`),

  /** Step 1 of the invoice upload — same shape/reasoning as
   *  `companyEmployeesService.presignAvatar`. */
  presignInvoice: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ApiWrapper<{ uploadUrl: string; fileUrl: string; expiresIn: number }>>(
        "/it-bills/invoice-presign",
        form,
        { headers: { "Content-Type": undefined } }
      )
      .then((r) => r.data.data);
  },

  /** Step 2: PUT the raw bytes straight to S3, bypassing this API. */
  uploadInvoiceToS3: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Invoice upload failed: ${res.status}`);
  },

  /** Both steps. Returns `{ fileUrl, fileName }` to save on create/update —
   *  the presign step alone doesn't touch the bill record. */
  uploadInvoice: async (file: File): Promise<{ fileUrl: string; fileName: string }> => {
    const { uploadUrl, fileUrl } = await itBillsService.presignInvoice(file);
    await itBillsService.uploadInvoiceToS3(uploadUrl, file);
    return { fileUrl, fileName: file.name };
  },
};

/** One call powers the whole IT Management main screen — see doc §7. */
export const itDashboardService = {
  overview: () =>
    api
      .get<ApiWrapper<DashboardOverview>>("/it-dashboard/overview")
      .then((r) => r.data.data),
};
