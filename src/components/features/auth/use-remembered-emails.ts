"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  parseRememberedEmails,
  REMEMBERED_EMAILS_KEY,
  withoutRememberedEmail,
  withRememberedEmail,
} from "@/lib/remembered-emails";

/**
 * The emails used on this device (src/lib/remembered-emails.ts) for the
 * login and sign-up forms' <datalist>. The server snapshot (and hydration) is
 * empty, so nothing mismatches; the list appears right after.
 *
 * rememberOnSubmit(form) stores the typed email when the form is sent. If the
 * server answers with a failure (wrong password, email taken …), an email
 * that was new is taken out again, so a typo is never suggested. A success
 * redirects, and the email stays.
 */

const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(REMEMBERED_EMAILS_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseRememberedEmails(raw);
  }
  return cachedList;
}

function write(list: string[]) {
  try {
    window.localStorage.setItem(REMEMBERED_EMAILS_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: no suggestions on this device.
  }
  for (const listener of listeners) listener();
}

export function useRememberedEmails(failureState: unknown) {
  const emails = useSyncExternalStore(subscribe, read, () => EMPTY);
  const pendingNew = useRef<string | null>(null);

  // A failed submit: forget an email that was new.
  useEffect(() => {
    if (!failureState || !pendingNew.current) return;
    write(withoutRememberedEmail(read(), pendingNew.current));
    pendingNew.current = null;
  }, [failureState]);

  function rememberOnSubmit(form: HTMLFormElement) {
    const email = new FormData(form).get("email");
    if (typeof email !== "string") return;
    const before = read();
    const after = withRememberedEmail(before, email);
    pendingNew.current = after[0] && !before.includes(after[0]) ? after[0] : null;
    write(after);
  }

  return { emails, rememberOnSubmit };
}
