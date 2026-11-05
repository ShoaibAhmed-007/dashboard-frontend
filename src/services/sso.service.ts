import { api } from "@/lib/api";

export interface OdooSsoRedirect {
  token: string;
  redirectUrl: string;
}

export const ssoService = {
  redirectToOdoo: () => api.post<OdooSsoRedirect>("/sso/odoo/redirect"),
};
