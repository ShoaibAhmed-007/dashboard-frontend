import {
  GroupedStatuses,
  ReorderGroupsPayload,
  StatusItem,
  statusService,
} from "@/services/status.service";
import {
  cloneLocalProjectStatusGroups,
  LocalProjectStatusGroup,
} from "@/components/projects/ProjectStatusEditor";

function flattenGroupedStatusesForSync(grouped: GroupedStatuses): StatusItem[] {
  return [
    ...grouped.groups.notStarted,
    ...grouped.groups.active,
    ...grouped.groups.done,
    ...grouped.groups.closed,
  ];
}

function attachDefaultStatusIds(
  groups: LocalProjectStatusGroup[],
  initialGrouped: GroupedStatuses
) {
  const defaultStatusIdMap: Record<string, string | undefined> = {
    default_todo: initialGrouped.groups.notStarted[0]?.id,
    default_inprogress: initialGrouped.groups.active[0]?.id,
    default_review: initialGrouped.groups.done[0]?.id,
    default_completed: initialGrouped.groups.closed[0]?.id,
  };

  for (const group of groups) {
    for (const status of group.statuses) {
      if (!status.id && defaultStatusIdMap[status.tempId]) {
        status.id = defaultStatusIdMap[status.tempId];
      }
    }
  }
}

function findReplacementStatusId(
  deletedId: string,
  initialById: Map<string, StatusItem>,
  survivors: Array<{ id: string; group: StatusItem["group"] }>
) {
  const deletedStatus = initialById.get(deletedId);
  if (!deletedStatus) {
    return survivors[0]?.id;
  }

  return (
    survivors.find((status) => status.group === deletedStatus.group)?.id ??
    survivors[0]?.id
  );
}

function buildReorderPayload(groups: LocalProjectStatusGroup[]): ReorderGroupsPayload {
  return {
    notStarted:
      groups.find((group) => group.apiGroup === "NOT_STARTED")?.statuses
        .map((status) => status.id)
        .filter((id): id is string => Boolean(id)) ?? [],
    active:
      groups.find((group) => group.apiGroup === "ACTIVE")?.statuses
        .map((status) => status.id)
        .filter((id): id is string => Boolean(id)) ?? [],
    done:
      groups.find((group) => group.apiGroup === "DONE")?.statuses
        .map((status) => status.id)
        .filter((id): id is string => Boolean(id)) ?? [],
    closed:
      groups.find((group) => group.apiGroup === "CLOSED")?.statuses
        .map((status) => status.id)
        .filter((id): id is string => Boolean(id)) ?? [],
  };
}

export async function syncProjectStatuses(
  projectId: string,
  initialGrouped: GroupedStatuses,
  nextGroups: LocalProjectStatusGroup[]
) {
  const workingGroups = cloneLocalProjectStatusGroups(nextGroups);
  const initialStatuses = flattenGroupedStatusesForSync(initialGrouped);
  const initialById = new Map(initialStatuses.map((status) => [status.id, status]));

  attachDefaultStatusIds(workingGroups, initialGrouped);

  for (const group of workingGroups) {
    if (group.apiGroup === "CLOSED") {
      continue;
    }

    for (const status of group.statuses) {
      if (status.id) {
        continue;
      }

      const created = await statusService.create({
        projectId,
        name: status.name.trim(),
        color: status.color,
        group: group.apiGroup,
      });
      status.id = created.id;
    }
  }

  for (const group of workingGroups) {
    for (const status of group.statuses) {
      if (!status.id) {
        continue;
      }

      const initial = initialById.get(status.id);
      if (!initial) {
        continue;
      }

      const name = status.name.trim();
      const color = status.color;
      const payload: { name?: string; color?: string } = {};

      if (name !== initial.name) {
        payload.name = name;
      }
      if (color !== initial.color) {
        payload.color = color;
      }

      if (payload.name || payload.color) {
        await statusService.update(status.id, payload);
      }
    }
  }

  const finalStatuses = workingGroups.flatMap((group) =>
    group.statuses
      .map((status) =>
        status.id
          ? {
              id: status.id,
              group: group.apiGroup,
            }
          : null
      )
      .filter((status): status is { id: string; group: StatusItem["group"] } => Boolean(status))
  );

  const finalIds = new Set(finalStatuses.map((status) => status.id));
  const deletedIds = initialStatuses
    .map((status) => status.id)
    .filter((id) => !finalIds.has(id));

  for (const deletedId of deletedIds) {
    const replacementStatusId = findReplacementStatusId(
      deletedId,
      initialById,
      finalStatuses
    );
    await statusService.delete(deletedId, replacementStatusId);
  }

  return statusService.reorder(projectId, buildReorderPayload(workingGroups));
}
