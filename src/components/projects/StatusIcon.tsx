"use client";

import { LuCircleDashed, LuCircleCheck } from "react-icons/lu";
import { RiProgress3Line } from "react-icons/ri";
import { IoIosCheckmarkCircle } from "react-icons/io";

type StatusGroup = "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";

interface StatusIconProps {
  group: StatusGroup;
  color: string;
  size?: number;
}

export default function StatusIcon({ group, color, size = 14 }: StatusIconProps) {
  const style = { color, width: size, height: size, flexShrink: 0 };

  if (group === "NOT_STARTED") {
    return <LuCircleDashed style={style} />;
  }
  if (group === "ACTIVE") {
    return <RiProgress3Line style={style} />;
  }
  if (group === "CLOSED") {
    return <IoIosCheckmarkCircle style={style} />;
  }
  return <LuCircleCheck style={style} />;
}
