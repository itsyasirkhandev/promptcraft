import * as React from 'react';

/**
 * Layout for /dashboard/workspace - overrides the default padded `<main>` via
 * a negative-margin full-bleed trick so the workspace can control its own
 * height and scroll behaviour.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
