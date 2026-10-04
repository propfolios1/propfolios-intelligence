"use client";

import { useUser } from "@clerk/nextjs";
import * as React from "react";

/** Biometric sign-in: a passkey (Face ID, Touch ID, Android fingerprint) registered through Clerk's WebAuthn support. */
export function PasskeySetup() {
  const { user } = useUser();
  const [state, setState] = React.useState<"idle" | "working" | "done" | "error">("idle");
  const count = user?.passkeys?.length ?? 0;
  return (
    <div>
      <p className="text-[13px] text-ink-700">{count ? `${count} passkey${count === 1 ? "" : "s"} registered. Sign in with Face ID, Touch ID or the phone's fingerprint.` : "Register this phone's Face ID, Touch ID or fingerprint to sign in without a password."}</p>
      <button
        type="button"
        disabled={!user || state === "working"}
        onClick={async () => {
          setState("working");
          try {
            await user!.createPasskey();
            setState("done");
          } catch {
            setState("error");
          }
        }}
        className="mt-3 h-10 w-full rounded-sm border border-navy-900 text-[14px] text-navy-900 disabled:opacity-60"
      >
        {state === "working" ? "Waiting for the device" : state === "done" ? "Passkey added" : "Add a passkey"}
      </button>
      {state === "error" && <p className="mt-2 text-[12px] text-danger">The device did not create a passkey. Try again, or check that biometrics are set up on the phone.</p>}
    </div>
  );
}
