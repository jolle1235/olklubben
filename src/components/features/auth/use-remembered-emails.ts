"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { ActionError } from "@/lib/action-result";
import {
  normalizeRememberedEmail,
  parseRememberedEmails,
  REMEMBERED_EMAILS_KEY,
  withRememberedEmail,
} from "@/lib/remembered-emails";

/**
 * The emails used on this device (src/lib/remembered-emails.ts) for the
 * login and sign-up forms' suggestions. The server snapshot (and hydration)
 * is empty, so nothing mismatches; the list appears right after.
 *
 * The list lives in a module cache: read from localStorage once, then kept
 * up to date by write() and by the `storage` event (another tab).
 *
 * `onValidSubmit` (for useActionForm) stores the typed email when the form is
 * sent. If the server answers with an error (`serverError`: wrong password,
 * email taken …), an email that was new is taken out again, so a typo is
 * never suggested. A success redirects, and the email stays.
 */

const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cache: string[] | null = null;

function load(): string[] {
  try {
    return parseRememberedEmails(window.localStorage.getItem(REMEMBERED_EMAILS_KEY));
  } catch {
    return EMPTY;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== REMEMBERED_EMAILS_KEY) return;
  cache = load();
  notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function read(): string[] {
  cache ??= load();
  return cache;
}

function write(list: string[]) {
  cache = list;
  try {
    window.localStorage.setItem(REMEMBERED_EMAILS_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the list lasts until the page is reloaded.
  }
  notify();
}

export function useRememberedEmails(serverError: ActionError | null) {
  const emails = useSyncExternalStore(subscribe, read, () => EMPTY);
  const pendingNew = useRef<string | null>(null);

  useEffect(() => {
    const email = pendingNew.current;
    if (!serverError || !email) return;
    pendingNew.current = null;
    write(read().filter((e) => e !== email));
  }, [serverError]);

  function onValidSubmit(form: HTMLFormElement) {
    const field = form.elements.namedItem("email");
    const email = field instanceof HTMLInputElement ? normalizeRememberedEmail(field.value) : null;
    if (!email) return;
    const before = read();
    pendingNew.current = before.includes(email) ? null : email;
    write(withRememberedEmail(before, email));
  }

  return { emails, onValidSubmit };
}
