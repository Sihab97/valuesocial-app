"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PublicProfile = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  image: string | null;
  createdAt: string;
  _count: {
    posts: number;
    followers: number;
    following: number;
  };
};

type ApiPost = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
  };
  _count: {
    likes: number;
    comments: number;
  };
};

export default function OtherUserProfileClient({ userId }: { userId: string }) {
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadPublicProfile() {
      setLoading(true);
      setNotice("");

      try {
        const [profileResponse, postsResponse, followResponse] =
          await Promise.all([
            fetch(`/api/profile?userId=${encodeURIComponent(userId)}`),
            fetch("/api/posts"),
            fetch(`/api/follow?userId=${encodeURIComponent(userId)}`),
          ]);

        const profileData = await profileResponse.json();
        const postsData = await postsResponse.json();
        const followData = await followResponse.json();

        if (!profileResponse.ok) {
          throw new Error(profileData.error || "Unable to load this profile.");
        }

        if (cancelled) return;

        setProfile(profileData.user);

        if (postsResponse.ok) {
          setPosts(
            (postsData.posts || []).filter(
              (post: ApiPost) => post.author.id === userId
            )
          );
        }

        if (followResponse.ok) {
          setIsFollowing(Boolean(followData.following));
          setProfile((previous) =>
            previous
              ? {
                  ...previous,
                  _count: {
                    ...previous._count,
                    followers:
                      followData.followersCount ?? previous._count.followers,
                    following:
                      followData.followingCount ?? previous._count.following,
                  },
                }
              : previous
          );
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error ? error.message : "Unable to load profile."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPublicProfile();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;

    setFollowLoading(true);
    setNotice("");

    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update follow status.");
      }

      setIsFollowing(Boolean(data.following));
      setProfile((previous) =>
        previous
          ? {
              ...previous,
              _count: {
                ...previous._count,
                followers: data.followersCount ?? previous._count.followers,
              },
            }
          : previous
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to update follow status."
      );
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading profile...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-center">
        <p className="text-red-600">{notice || "User not found."}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white"
        >
          Back to Home
        </button>
      </main>
    );
  }

  const initials =
    profile.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← Back
        </button>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {profile.image ? (
              <img
                src={profile.image}
                alt={profile.name}
                className="h-24 w-24 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-3xl font-bold text-indigo-700">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {profile.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">@{profile.username}</p>
              <p className="mt-3 text-sm text-slate-600">
                {profile.bio || "No bio added yet."}
              </p>
            </div>

            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isFollowing
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {followLoading
                ? "Please wait..."
                : isFollowing
                  ? "Following"
                  : "Follow"}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-8 border-t border-slate-100 pt-5">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {profile._count.posts}
              </p>
              <p className="text-sm text-slate-500">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {profile._count.followers}
              </p>
              <p className="text-sm text-slate-500">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {profile._count.following}
              </p>
              <p className="text-sm text-slate-500">Following</p>
            </div>
          </div>
        </section>

        {notice && (
          <p aria-live="polite" className="mt-4 text-sm text-red-600">
            {notice}
          </p>
        )}

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            {profile.name}&apos;s Posts
          </h2>

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">No posts yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {post.content}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-5 border-t border-slate-100 pt-3 text-sm text-slate-500">
                    <span>❤️ {post._count.likes} Likes</span>
                    <span>💬 {post._count.comments} Comments</span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
