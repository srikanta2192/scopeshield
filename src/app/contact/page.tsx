import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | ScopeShield",
  description:
    "Get in touch about custom agency plans or questions about our methodology.",
};

/**
 * Public contact page — simple inquiry form.
 * Server component; form action can be wired to a Route Handler later.
 */
export default function ContactPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 font-serif text-3xl text-ink">Get in touch</h1>
        <p className="mb-8 font-serif text-sm text-ink-light">
          Need help with a custom agency plan or have a question about our
          methodology?
        </p>

        <form className="space-y-4" action="#" method="POST">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-ink focus:border-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-ink focus:border-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-ink focus:border-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-ink py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
