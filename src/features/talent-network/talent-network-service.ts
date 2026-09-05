import { getSupabase } from "@/lib/supabase";
import type {
  OrganizationIncomingAccessRequest,
  OrganizationTalentAuditLogItem,
  TalentNetworkOrganization,
  TalentNetworkProfileDetails,
  TalentNetworkProfileListItem,
  TalentSearchFilter,
  TalentViewerAccessRequestItem,
} from "@/types/talent-network";

/**
 * Fetch all participating organizations and caller's access request status.
 * Accessible strictly by Talent Viewers.
 */
export async function fetchTalentNetworkOrganizations(): Promise<
  TalentNetworkOrganization[]
> {
  const { data, error } = await getSupabase().rpc(
    "get_talent_network_organizations",
  );
  if (error) {
    throw new Error(
      error.message || "Failed to load participating organizations.",
    );
  }
  return (data as TalentNetworkOrganization[]) ?? [];
}

/**
 * Request access to a participating organization.
 * Accessible strictly by Talent Viewers.
 */
export async function requestOrganizationAccess(
  organizationId: string,
): Promise<{
  id: string;
  organization_id: string;
  organization_name: string;
  status: string;
  requested_at: string;
}> {
  const { data, error } = await getSupabase().rpc(
    "request_talent_organization_access",
    {
      p_organization_id: organizationId,
    },
  );
  if (error) {
    throw new Error(
      error.message || "Failed to submit organization access request.",
    );
  }
  return data;
}

/**
 * Fetch all access requests made by the authenticated Talent Viewer.
 */
export async function fetchMyOrganizationAccess(): Promise<
  TalentViewerAccessRequestItem[]
> {
  const { data, error } = await getSupabase().rpc(
    "get_my_talent_organization_access",
  );
  if (error) {
    throw new Error(
      error.message || "Failed to load organization access requests.",
    );
  }
  return (data as TalentViewerAccessRequestItem[]) ?? [];
}

/**
 * Discover approved professional talent profiles across approved organizations.
 * Server strictly enforces that viewer has approved access to queried organization(s).
 */
export async function fetchTalentNetworkProfiles(
  filter?: TalentSearchFilter,
): Promise<TalentNetworkProfileListItem[]> {
  const { data, error } = await getSupabase().rpc(
    "get_talent_network_profiles",
    {
      p_organization_id: filter?.organization_id || null,
      p_search: filter?.search?.trim() || null,
      p_skill: filter?.skill?.trim() || null,
      p_limit: filter?.limit ?? 50,
      p_offset: filter?.offset ?? 0,
    },
  );
  if (error) {
    throw new Error(error.message || "Failed to discover talent profiles.");
  }
  return (data as TalentNetworkProfileListItem[]) ?? [];
}

/**
 * Fetch full approved professional portfolio for a specific Talent ID.
 * Server verifies viewer has approved access to the organization owning that Talent ID.
 */
export async function fetchTalentNetworkProfileDetails(
  talentId: string,
): Promise<TalentNetworkProfileDetails> {
  const { data, error } = await getSupabase().rpc(
    "get_talent_network_profile_details",
    {
      p_talent_id: talentId,
    },
  );
  if (error) {
    throw new Error(error.message || "Failed to load Talent Profile details.");
  }
  return data as TalentNetworkProfileDetails;
}

/**
 * Fetch incoming Talent Viewer access requests for the authenticated user's organization.
 * Accessible strictly by HR and Admin.
 */
export async function fetchOrganizationTalentViewerRequests(): Promise<
  OrganizationIncomingAccessRequest[]
> {
  const { data, error } = await getSupabase().rpc(
    "get_organization_talent_viewer_requests",
  );
  if (error) {
    throw new Error(
      error.message || "Failed to load Talent Viewer access requests.",
    );
  }
  return (data as OrganizationIncomingAccessRequest[]) ?? [];
}

/**
 * Review (Approve, Reject, Suspend) an incoming Talent Viewer access request.
 * Accessible strictly by HR and Admin scoped to their organization.
 */
export async function reviewTalentViewerAccessRequest(
  requestId: string,
  status: "approved" | "rejected" | "suspended",
  notes?: string,
): Promise<{
  id: string;
  organization_id: string;
  status: string;
  reviewed_at: string;
  reviewer_notes: string | null;
}> {
  const { data, error } = await getSupabase().rpc(
    "review_talent_viewer_access_request",
    {
      p_request_id: requestId,
      p_status: status,
      p_notes: notes?.trim() || null,
    },
  );
  if (error) {
    throw new Error(error.message || "Failed to review access request.");
  }
  return data;
}

/**
 * Fetch talent network audit logs for the authenticated HR/Admin's organization.
 */
export async function fetchOrganizationTalentAuditLogs(
  limit = 50,
): Promise<OrganizationTalentAuditLogItem[]> {
  const { data, error } = await getSupabase().rpc(
    "get_organization_talent_audit_logs",
    {
      p_limit: limit,
    },
  );
  if (error) {
    throw new Error(
      error.message || "Failed to load organization talent audit logs.",
    );
  }
  return (data as OrganizationTalentAuditLogItem[]) ?? [];
}
