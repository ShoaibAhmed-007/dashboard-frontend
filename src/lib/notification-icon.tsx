import type { IconType } from "react-icons";
import {
  LuBell,
  LuClipboardList,
  LuMessageSquare,
  LuAtSign,
  LuSmile,
  LuLaptop,
  LuUsers,
  LuReceipt,
  LuClipboardPlus,
} from "react-icons/lu";

/**
 * Picks a representative icon for a notification's `type`/`referenceType` —
 * shared between the header dropdown (`NotificationDropdown`) and the live
 * toast banner (`NotificationContext`) so both render the same taxonomy
 * instead of two hand-maintained copies drifting apart.
 */
export function notificationIconFor(type: string, referenceType: string): IconType {
  if (referenceType === "comment" || type.startsWith("comment")) return LuMessageSquare;
  if (type === "mentioned") return LuAtSign;
  if (type.startsWith("reaction")) return LuSmile;
  if (referenceType === "task" || type.startsWith("task")) return LuClipboardList;
  if (referenceType === "asset") return LuLaptop;
  if (referenceType === "company_employee") return LuUsers;
  if (referenceType === "it_bill") return LuReceipt;
  if (referenceType === "it_request") return LuClipboardPlus;
  return LuBell;
}
