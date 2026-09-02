// SPDX-License-Identifier: AGPL-3.0-only
import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="grid place-items-center py-24">
      <Spinner />
    </div>
  );
}
