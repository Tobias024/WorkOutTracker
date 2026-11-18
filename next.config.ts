// SPDX-License-Identifier: AGPL-3.0-only
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Una carpeta literal ".well-known" en App Router es un riesgo conocido
  // (el punto inicial del nombre puede confundir la tooling/el routing) —
  // se resuelve con un rewrite hacia una ruta interna sin el punto, en vez
  // de intentar la carpeta con punto y descubrir el problema en el camino.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/well-known/oauth-protected-resource",
      },
    ];
  },
};

export default nextConfig;
