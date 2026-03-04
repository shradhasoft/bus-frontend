import React from "react";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicyPage() {
  const lastUpdated = "February 24, 2026";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-rose-600 dark:prose-a:text-rose-400 hover:prose-a:text-rose-500 rounded-3xl bg-white p-8 sm:p-12 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="lead text-xl text-slate-500 dark:text-slate-400">
            At BookMySeat, we take your privacy seriously. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your
            information when you visit our website or use our mobile
            application.
          </p>

          <hr className="my-8 border-slate-200 dark:border-slate-800" />

          <h2>1. Information We Collect</h2>
          <p>
            We collect personal information that you voluntarily provide to us
            when registering at the Services, expressing an interest in
            obtaining information about us or our products and services, when
            participating in activities on the Services or otherwise contacting
            us.
          </p>
          <ul>
            <li>
              <strong>Personal Info Provided by You:</strong> Names, phone
              numbers, email addresses, mailing addresses, usernames, passwords,
              and other similar information.
            </li>
            <li>
              <strong>Payment Data:</strong> Data necessary to process your
              payment if you make purchases, such as your payment instrument
              number and the security code associated with your payment
              instrument.
            </li>
            <li>
              <strong>Social Media Login Data:</strong> We may provide you with
              the option to register using social media account details, like
              your Google or Facebook account.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>
            We process your information for purposes based on legitimate
            business interests, the fulfillment of our contract with you,
            compliance with our legal obligations, and/or your consent.
          </p>
          <ul>
            <li>To facilitate account creation and logon process.</li>
            <li>To send administrative information to you.</li>
            <li>
              To fulfill and manage your orders, payments, returns, and
              exchanges.
            </li>
            <li>To protect our Services from fraud or abuse.</li>
          </ul>

          <h2>3. Will Your Information be Shared with Anyone?</h2>
          <p>
            We only share information with your consent, to comply with laws, to
            provide you with services (such as sharing details with Bus
            Operators you book tickets with), to protect your rights, or to
            fulfill business obligations.
          </p>

          <h2>4. How Long Do We Keep Your Information?</h2>
          <p>
            We will only keep your personal information for as long as it is
            necessary for the purposes set out in this privacy notice, unless a
            longer retention period is required or permitted by law (such as
            tax, accounting or other legal requirements).
          </p>

          <h2>5. How Do We Keep Your Information Safe?</h2>
          <p>
            We have implemented appropriate technical and organizational
            security measures designed to protect the security of any personal
            information we process. However, no electronic transmission over the
            internet or information storage technology can be guaranteed to be
            100% secure.
          </p>

          <div className="mt-12 rounded-2xl bg-slate-50 p-6 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold mt-0 mb-2">
              Questions or Concerns?
            </h3>
            <p className="mb-0 text-sm">
              If you have any questions or comments about this policy, you may
              email us at{" "}
              <a href="mailto:privacy@bookmyseat.in">privacy@bookmyseat.in</a>{" "}
              or by post to our registered office in Bengaluru, Karnataka,
              India.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
