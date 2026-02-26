"use client";

import BoardedUsersBlueprint from "@/app/(protected)/conductor/dashboard/boarded-users/_components/boarded-users-blueprint";

export default function OwnerBoardedUsersPage() {
  return <BoardedUsersBlueprint mode="owner" />;
}
