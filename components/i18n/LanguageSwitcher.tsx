"use client";

import { useEffect } from "react";
import { useLanguage, setAppLanguage } from "./languageStore";

const languages = [
  { code: "es", name: "🇪🇸 Español" },
  { code: "en", name: "🇬🇧 English" },
  { code: "fr", name: "🇫🇷 Français" },
  { code: "de", name: "🇩🇪 Deutsch" },
  { code: "it", name: "��🇹 Italiano" },
  { code: "pt", name: "🇵🇹 Português" },
  { code: "ar", name: "🇸🇦 العربية" },
  { code: "zh", name: "🇨🇳 中文" },
  { code: "ja", name: "🇯🇵 日本語" },
];

export default function LanguageSwitcher() {
  const language = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  return (
    <div className="fixed right-4 top-4 z-[9999]">
      <label htmlFor="irvin-language" className="sr-only">
        Seleccionar idioma
      </label>
      <select
        id="irvin-language"
        value={language}
        onChange={(e) => setAppLanguage(e.target.value)}
        className="rounded-xl border border-white/20 bg-[#07111c] px-3 py-2 text-sm text-white shadow-xl"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
