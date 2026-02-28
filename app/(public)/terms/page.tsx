import React from "react";
import { Scale } from "lucide-react";

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-rose-600 dark:prose-a:text-rose-400 hover:prose-a:text-rose-500 rounded-3xl bg-white p-8 sm:p-12 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="lead text-xl text-slate-500 dark:text-slate-400">
            Please read these terms and conditions carefully before using Our
            Service. These Terms outline your rights and responsibilities when
            using BookMySeat.
          </p>

          <hr className="my-8 border-slate-200 dark:border-slate-800" />

          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using the Service, You agree to be bound by these
            Terms and Conditions. If You disagree with any part of these Terms
            and Conditions, then You may not access the Service.
          </p>

          <h2>2. Use of the Service</h2>
          <p>
            Our Service allows you to search for, compare, and book bus tickets.
            We act solely as an intermediary between you and bus operators.
          </p>
          <ul>
            <li>You must be at least 18 years old to use the Service.</li>
            <li>
              You are responsible for maintaining the confidentiality of your
              account.
            </li>
            <li>
              You agree not to use the Service for any illegal or unauthorized
              purpose.
            </li>
          </ul>

          <h2>3. Bookings and Payments</h2>
          <p>
            When you make a booking, you are entering into a contract directly
            with the bus operator. BookMySeat is not responsible for the actual
            performance of the bus service.
          </p>
          <p>
            Payment must be made in full at the time of booking. Prices are
            subject to change without notice, but confirmed bookings will not be
            affected.
          </p>

          <h2>4. Cancellations and Refunds</h2>
          <p>
            Cancellations and refunds are subject to the policies of the
            respective bus operator. BookMySeat may charge a nominal
            cancellation fee in addition to the operator&apos;s fee. Please
            refer to our <a href="/help#refunds">Refund Policy</a> for detailed
            information.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            BookMySeat shall not be liable for any indirect, incidental,
            special, consequential or punitive damages, including without
            limitation, loss of profits, data, use, goodwill, or other
            intangible losses, resulting from (i) your access to or use of or
            inability to access or use the Service; (ii) any conduct or content
            of any third party on the Service; (iii) any content obtained from
            the Service; and (iv) unauthorized access, use or alteration of your
            transmissions or content.
          </p>

          <h2>6. Changes to Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. By continuing to access or use our Service
            after those revisions become effective, you agree to be bound by the
            revised terms.
          </p>

          <div className="mt-12 rounded-2xl bg-rose-50 p-6 dark:bg-rose-500/10">
            <h3 className="text-lg font-semibold mt-0 mb-2 text-rose-900 dark:text-rose-100">
              Contact Us
            </h3>
            <p className="mb-0 text-sm text-rose-800 dark:text-rose-200">
              If you have any questions about these Terms, please contact us at{" "}
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
