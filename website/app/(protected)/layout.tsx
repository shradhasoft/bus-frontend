export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import ProtectedShell from "./protected-shell";

const ProtectedLayout = ({ children }: { children: ReactNode }) => {
  return <ProtectedShell>{children}</ProtectedShell>;
};

export default ProtectedLayout;
