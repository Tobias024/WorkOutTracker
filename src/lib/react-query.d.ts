// SPDX-License-Identifier: AGPL-3.0-only
import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}
