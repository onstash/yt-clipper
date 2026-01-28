/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "@/styles/globals.css?url";
import { DryRunProvider } from "@/contexts/DryRunContext";
import { DryRunToggle } from "@/components/DryRunToggle";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "YouTube Clipper" },
      {
        name: "description",
        content: "Download and clip YouTube videos with precision",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <DryRunProvider>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </DryRunProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="fixed top-4 right-4 z-50">
          <DryRunToggle />
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
