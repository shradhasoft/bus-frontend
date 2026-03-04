import React from "react";
import { Cookie } from "lucide-react";

export default function CookiePolicyPage() {
  const lastUpdated = "February 24, 2026";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <Cookie className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl mb-4">
            Cookie Policy
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-rose-600 dark:prose-a:text-rose-400 hover:prose-a:text-rose-500 rounded-3xl bg-white p-8 sm:p-12 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="lead text-xl text-slate-500 dark:text-slate-400">
            This Cookie Policy explains how BookMySeat uses cookies and similar
            technologies to recognize you when you visit our website. It
            explains what these technologies are and why we use them.
          </p>

          <hr className="my-8 border-slate-200 dark:border-slate-800" />

          <h2>1. What are cookies?</h2>
          <p>
            Cookies are small data files that are placed on your computer or
            mobile device when you visit a website. Cookies are widely used by
            website owners in order to make their websites work, or to work more
            efficiently, as well as to provide reporting information.
          </p>

          <h2>2. Why do we use cookies?</h2>
          <p>
            We use first-party and third-party cookies for several reasons. Some
            cookies are required for technical reasons in order for our Website
            to operate, and we refer to these as &quot;essential&quot; or
            &quot;strictly necessary&quot; cookies. Other cookies also enable us
            to track and target the interests of our users to enhance the
            experience on our Website.
          </p>

          <h2>3. Types of Cookies We Use</h2>

          <div className="space-y-6 my-8">
            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-lg font-semibold mt-0 mb-2">
                Essential Cookies
              </h3>
              <p className="m-0 text-sm">
                Strictly necessary to provide you with services available
                through our Website and to use some of its features, such as
                access to secure areas.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-lg font-semibold mt-0 mb-2">
                Performance and Functionality Cookies
              </h3>
              <p className="m-0 text-sm">
                Used to enhance the performance and functionality of our Website
                but are non-essential to their use. However, without these
                cookies, certain functionality may become unavailable.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-lg font-semibold mt-0 mb-2">
                Analytics and Customization Cookies
              </h3>
              <p className="m-0 text-sm">
                Collect information that is used either in aggregate form to
                help us understand how our Website is being used or how
                effective our marketing campaigns are, or to help us customize
                our Website for you.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-lg font-semibold mt-0 mb-2">
                Advertising Cookies
              </h3>
              <p className="m-0 text-sm">
                Used to make advertising messages more relevant to you. They
                perform functions like preventing the same ad from continuously
                reappearing and selecting advertisements that are based on your
                interests.
              </p>
            </div>
          </div>

          <h2>4. How can I control cookies?</h2>
          <p>
            You have the right to decide whether to accept or reject cookies.
            You can exercise your cookie rights by changing your preferences
            directly within your browser settings. As the means by which you can
            refuse cookies through your web browser controls vary from
            browser-to-browser, you should visit your browser&apos;s help menu
            for more information.
          </p>

          <h2>5. Updates to this policy</h2>
          <p>
            We may update this Cookie Policy from time to time in order to
            reflect, for example, changes to the cookies we use or for other
            operational, legal or regulatory reasons. Please therefore re-visit
            this Cookie Policy regularly to stay informed about our use of
            cookies and related technologies.
          </p>
        </div>
      </div>
    </main>
  );
}
