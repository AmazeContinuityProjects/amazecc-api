/**
 * fetch() that verifies VIT's incomplete certificate chains correctly.
 *
 * VIT's servers (vtopcc, eventhubcc, lms, directorycc, ...) serve only the
 * leaf certificate and omit the Sectigo public DV R36 intermediate, so Node's
 * default verification fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE. The old
 * code disabled verification process-wide (NODE_TLS_REJECT_UNAUTHORIZED=0),
 * which let anyone on the network path read VTOP/EventHub passwords.
 *
 * This wrapper pins the intermediate (see vitTls.ts) and verifies normally.
 * Use it for every outbound request to a *.vit.ac.in host - plain fetch()
 * will fail here, and the global flag must never come back.
 */
import { Agent, fetch as undiciFetch } from "undici";
import type { RequestInit as UndiciRequestInit } from "undici";
import { VIT_CA } from "./vitTls";

const vitAgent = new Agent({
  connect: {
    ca: VIT_CA,
  },
});

type VitFetchInit = Omit<UndiciRequestInit, "dispatcher"> & {
  signal?: AbortSignal | null;
};

export function vitFetch(input: string, init?: VitFetchInit) {
  return undiciFetch(input, { ...(init ?? {}), dispatcher: vitAgent });
}
