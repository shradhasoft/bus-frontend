"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGES = [
  { code: "en" as const, label: "English", nativeLabel: "English" },
  { code: "hi" as const, label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "or" as const, label: "Odia", nativeLabel: "ଓଡ଼ିଆ" },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("languageSwitcher");

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as "en" | "hi" | "or" });
  };

  const current = LANGUAGES.find((l) => l.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 p-2 rounded-full text-slate-700
            transition-all duration-300 hover:bg-white/10 hover:text-slate-900
            dark:text-white/80 dark:hover:text-white"
          aria-label={t("changeLanguage")}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">
            {current?.nativeLabel}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="min-w-[140px] rounded-xl border border-slate-200
          bg-white/95 p-2 shadow-lg backdrop-blur
          dark:border-white/10 dark:bg-slate-950/95"
      >
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            className={`rounded-lg px-3 py-2 text-sm cursor-pointer
              ${
                locale === lang.code
                  ? "text-rose-600 font-semibold dark:text-rose-400"
                  : "text-slate-700 dark:text-white/85"
              }`}
            onSelect={() => handleChange(lang.code)}
          >
            <span>{lang.nativeLabel}</span>
            <span className="ml-auto text-xs text-slate-400">{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
