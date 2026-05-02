import React from "react";
import { Scale } from "lucide-react";
import { useTranslations } from "next-intl";

export default function TermsOfServicePage() {
  const t = useTranslations("terms");
  const lastUpdated = "February 24, 2026";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Scale className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t("lastUpdated", { date: lastUpdated })}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-rose-600 dark:prose-a:text-rose-400 hover:prose-a:text-rose-500 rounded-3xl bg-white p-8 sm:p-12 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="lead text-xl text-slate-500 dark:text-slate-400">
            {t("intro")}
          </p>

          <hr className="my-8 border-slate-200 dark:border-slate-800" />

          <h2>{t("agreementToTerms.title")}</h2>
          <p>{t("agreementToTerms.content")}</p>

          <h2>{t("useOfService.title")}</h2>
          <p>{t("useOfService.content")}</p>
          <ul>
            <li>{t("useOfService.rule1")}</li>
            <li>{t("useOfService.rule2")}</li>
            <li>{t("useOfService.rule3")}</li>
          </ul>

          <h2>{t("bookingsAndPayments.title")}</h2>
          <p>{t("bookingsAndPayments.content")}</p>
          <p>{t("bookingsAndPayments.paymentContent")}</p>

          <h2>{t("cancellationsAndRefunds.title")}</h2>
          <p>{t("cancellationsAndRefunds.content")}</p>

          <h2>{t("limitationOfLiability.title")}</h2>
          <p>{t("limitationOfLiability.content")}</p>

          <h2>{t("changesToTerms.title")}</h2>
          <p>{t("changesToTerms.content")}</p>

          <div className="mt-12 rounded-2xl bg-rose-50 p-6 dark:bg-rose-500/10">
            <h3 className="text-lg font-semibold mt-0 mb-2 text-rose-900 dark:text-rose-100">
              {t("contactUs.title")}
            </h3>
            <p className="mb-0 text-sm text-rose-800 dark:text-rose-200">
              {t("contactUs.content")}{" "}
              <a
                href="mailto:legal@bookmyseat.in"
                className="font-semibold underline"
              >
                legal@bookmyseat.in
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
