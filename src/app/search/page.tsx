
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SearchUser = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
};

export default function SearchPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const searchQuery = query.trim();

    if (searchQuery.length < 2) {
      setUsers([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Search failed. Please try again.");
        }

        const data = await response.json();
        setUsers(data);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Search
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Find people and connect with them on ValueSocial.
          </p>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
            🔍
          </span>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full rounded-xl border border-gray-200 bg-white py-4 pl-12 pr-12 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />

          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="mt-6">
          {query.trim().length < 2 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 text-4xl">👥</div>
              <h2 className="font-semibold text-gray-800 dark:text-white">
                Discover People
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Enter at least 2 characters to search for users.
              </p>
            </div>
          ) : loading ? (
            <p className="py-10 text-center text-gray-500">
              Searching...
            </p>
          ) : error ? (
            <p className="py-10 text-center text-red-500">{error}</p>
          ) : users.length === 0 ? (
            <div className="rounded-xl bg-white p-10 text-center dark:bg-gray-900">
              <div className="mb-3 text-4xl">🔎</div>
              <h2 className="font-semibold text-gray-800 dark:text-white">
                No users found
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Try searching with another name or username.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="mb-3 text-sm text-gray-500">
                {users.length} user(s) found
              </p>

              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => router.push(`/user/${user.id}`)}
                  className="flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 text-left transition hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-white">
                      {user.name}
                    </h3>

                    <p className="truncate text-sm text-blue-600">
                      @{user.username}
                    </p>

                    {user.bio && (
                      <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                        {user.bio}
                      </p>
                    )}
                  </div>

                  <span className="text-xl text-gray-400">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
