import { browser } from "wxt/browser";
import {
  type RuntimeRequest,
  type RuntimeResponse,
  fail,
  isRuntimeResponse,
} from "./runtime-messages";

// Send a request to the background worker and return its typed response. Shared by popup and
// options so the runtime-message round trip is defined (and validated) in exactly one place.
export async function sendToRuntime<T>(message: RuntimeRequest): Promise<RuntimeResponse<T>> {
  const response = await browser.runtime.sendMessage(message);
  if (!isRuntimeResponse<T>(response)) {
    return fail("No response from the background worker.");
  }

  return response;
}
