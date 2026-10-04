import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/** The current API request's method and path, set by handle() so deeper layers (trial read-only checks) can see them. */
export const requestContext = new AsyncLocalStorage<{ method: string; path: string }>();
