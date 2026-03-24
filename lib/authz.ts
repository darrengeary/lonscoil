import { UserRole } from "@prisma/client";

export type AppUser = {
  id: string;
  role: UserRole;
  schoolId?: string | null;
};

export function isAdmin(user: AppUser | null | undefined) {
  return user?.role === UserRole.ADMIN;
}

export function isSchoolAdmin(user: AppUser | null | undefined) {
  return user?.role === UserRole.SCHOOLADMIN;
}

export function isParent(user: AppUser | null | undefined) {
  return user?.role === UserRole.USER;
}

export function canAccessSchool(user: AppUser | null | undefined, schoolId: string) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isSchoolAdmin(user)) return user.schoolId === schoolId;
  return false;
}