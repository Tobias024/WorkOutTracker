// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `name` es lo que Android escribe bajo el ícono en el SPLASH que genera
    // solo (ícono + background_color + name). `short_name` es la etiqueta bajo
    // el ícono en el launcher y se trunca cerca de los 12 caracteres, así que
    // ahí el nombre largo no entra.
    //
    // Ojo al verificar: el WebAPK congela `name` al instalarse. Una PWA ya
    // instalada sigue mostrando el nombre viejo hasta que Chrome corre su
    // chequeo de actualización (~1 día); para verlo ya hay que desinstalar y
    // volver a agregar a la pantalla de inicio.
    name: "WorkOut, Logs & Friends",
    short_name: "WOLF",
    description: "Rutinas, registro y ranking con amigos.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090a",
    theme_color: "#09090b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
