"use client";

import { useSyncExternalStore } from "react";

const KEY = "irvin-language";
const EVENT = "irvin-language-change";
const supported = ["es", "en", "fr", "de", "it", "pt", "ar", "zh", "ja"];

function getSnapshot() {
  const saved = localStorage.getItem(KEY);
  return saved && supported.includes(saved) ? saved : "es";
}

function getServerSnapshot() {
  return "es";
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setAppLanguage(language: string) {
  if (!supported.includes(language)) return;
  localStorage.setItem(KEY, language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  window.dispatchEvent(new Event(EVENT));
}
