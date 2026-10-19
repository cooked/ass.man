import React from "react";
import { User as UserIcon } from "lucide-react";

interface UserBadgeProps {
  currentUser?: string;
  userRole?: string;
  allUsers?: any[];
  brandColor?: string;
  className?: string;
}

export const getRoleBadgeClasses = (role: string) => {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "bg-purple-100 text-purple-800 border-purple-200";
  if (r.startsWith("funzionario")) return "bg-blue-100 text-blue-800 border-blue-200";
  if (r.includes("amministrativo")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (r.includes("tecnico") || r.includes("operator")) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
};

export const UserBadge: React.FC<UserBadgeProps> = ({
  currentUser = "",
  userRole = "Operator",
  allUsers = [],
  brandColor = "rose",
  className = "",
}) => {
  if (!currentUser) return null;

  const matchedUser = allUsers.find(
    (u) => (u.username || "").toLowerCase() === currentUser.toLowerCase()
  );
  let initials = "";
  if (matchedUser?.name && matchedUser?.surname) {
    initials = `${matchedUser.name.charAt(0)}${matchedUser.surname.charAt(0)}`.toUpperCase();
  } else if (currentUser) {
    const parts = currentUser.trim().split(/\s+/);
    initials =
      parts.length > 1
        ? `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
        : currentUser.slice(0, 2).toUpperCase();
  }

  const displayName = matchedUser?.name && matchedUser?.surname
    ? `${matchedUser.name} ${matchedUser.surname}`
    : currentUser;

  const isRose = brandColor === "rose";

  return (
    <div className={`bg-white border border-slate-300 rounded px-1.5 py-1 shadow-xs ${className}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className={`w-5 h-5 rounded-full ${
            isRose ? "bg-rose-600" : "bg-indigo-600"
          } text-white flex items-center justify-center font-bold text-[9px] tracking-wider shadow-2xs shrink-0`}
        >
          {initials || <UserIcon className="w-3 h-3 text-white" />}
        </div>
        <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
          <span
            className="text-[10px] font-bold text-slate-800 tracking-tight truncate leading-none"
            title={displayName}
          >
            {displayName}
          </span>
          <span
            className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider shrink-0 leading-none ${getRoleBadgeClasses(
              userRole
            )}`}
          >
            {userRole}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UserBadge;
