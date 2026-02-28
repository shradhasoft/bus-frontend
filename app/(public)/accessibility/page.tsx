import React from "react";
import { Eye } from "lucide-react";

export default function AccessibilityPage() {
  const lastUpdated = "February 24, 2026";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Eye className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl mb-4">
            Accessibility Statement
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-rose-600 dark:prose-a:text-rose-400 hover:prose-a:text-rose-500 rounded-3xl bg-white p-8 sm:p-12 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <p className="lead text-xl text-slate-500 dark:text-slate-400">
            BookMySeat is committed to ensuring digital accessibility for people
            with disabilities. We are continually improving the user experience
            for everyone, and applying the relevant accessibility standards.
          </p>

          <hr className="my-8 border-slate-200 dark:border-slate-800" />

          <h2>Our Commitment</h2>
          <p>
            We view accessibility as an ongoing effort. Our team is dedicated to
            providing an inclusive experience. We have taken the following steps
            to ensure accessibility:
          </p>
          <ul>
            <li>Including accessibility throughout our internal policies.</li>
            <li>Integrating accessibility into our procurement practices.</li>
            <li>Appointing an accessibility officer and/or ombudsperson.</li>
            <li>Providing continual accessibility training for our staff.</li>
            <li>Assigning clear accessibility targets and responsibilities.</li>
            <li>Employing formal accessibility quality assurance methods.</li>
          </ul>

          <h2>Conformance Status</h2>
          <p>
            The{" "}
            <a
              href="https://www.w3.org/WAI/standards-guidelines/wcag/"
              target="_blank"
              rel="noreferrer"
            >
              Web Content Accessibility Guidelines (WCAG)
            </a>{" "}
            defines requirements for designers and developers to improve
            accessibility for people with disabilities. It defines three levels
            of conformance: Level A, Level AA, and Level AAA.
          </p>
          <p>
            BookMySeat is partially conformant with WCAG 2.1 level AA. Partially
            conformant means that some parts of the content do not fully conform
            to the accessibility standard.
          </p>

          <h2>Technical Specifications</h2>
          <p>
            Accessibility of BookMySeat relies on the following technologies to
            work with the particular combination of web browser and any
            assistive technologies or plugins installed on your computer:
          </p>
          <ul>
            <li>HTML</li>
            <li>WAI-ARIA</li>
            <li>CSS</li>
            <li>JavaScript</li>
          </ul>
          <p>
            These technologies are relied upon for conformance with the
            accessibility standards used.
          </p>

          <h2>Feedback & Limitations</h2>
          <p>
            We welcome your feedback on the accessibility of BookMySeat. Please
            let us know if you encounter accessibility barriers on our platform.
            We aim to respond to feedback within 2 business days.
          </p>
          <p>
            Despite our best efforts, there may be some content or features that
            are not yet fully accessible. This may be a result of not having
            found or identified the most appropriate technological solution.
          </p>

          <div className="mt-12 rounded-2xl bg-blue-50 p-6 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900/50">
            <h3 className="text-lg font-semibold mt-0 mb-2 text-blue-900 dark:text-blue-100">
              Contact Accessibility Team
            </h3>
            <p className="mb-0 text-sm text-blue-800 dark:text-blue-200">
              For any accessibility related queries or issues, please email our
              dedicated team at{" "}
              <a
                href="mailto:accessibility@bookmyseat.in"
                className="font-semibold underline"
              >
                accessibility@bookmyseat.in
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
