
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string | null;
  image: string | null;
  createdAt?: string;
};

type FollowUser = {
  id: string;
  name: string;
  username: string;
  image: string | null;
};

type Post = {
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

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followUsers, setFollowUsers] = useState<FollowUser[]>([]);
  const [loadingFollowUsers, setLoadingFollowUsers] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Load profile and posts
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadProfile() {
      try {
        const [profileResponse, postsResponse] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/posts"),
        ]);

        if (!profileResponse.ok) {
          throw new Error("Unable to load profile.");
        }

        const profileData = await profileResponse.json();
        const postsData = await postsResponse.json();

        if (cancelled) return;

        setProfile(profileData.user);
        setName(profileData.user.name);
        setBio(profileData.user.bio || "");

        const followResponse = await fetch(
          `/api/follow?userId=${encodeURIComponent(profileData.user.id)}`
        );
        if (followResponse.ok) {
          const followData = await followResponse.json();
          setFollowersCount(followData.followersCount ?? 0);
          setFollowingCount(followData.followingCount ?? 0);
        }

        if (postsResponse.ok) {
          setPosts(
            (postsData.posts || []).filter(
              (post: Post) => post.author.id === profileData.user.id
            )
          );
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Unable to load profile."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Load followers or following list.
  const handleOpenFollowList = async (type: "followers" | "following") => {
    if (!profile) return;

    setFollowListType(type);
    setFollowUsers([]);
    setLoadingFollowUsers(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/follow?userId=${encodeURIComponent(profile.id)}&type=${type}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load user list.");
      }

      setFollowUsers(data.users || []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load user list."
      );
      setFollowListType(null);
    } finally {
      setLoadingFollowUsers(false);
    }
  };

  // Select profile picture
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setNotice("Please select a JPG, PNG or WEBP image.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice("Image size cannot exceed 5 MB.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setNotice("Image selected. Click Upload Picture to continue.");
  };

  // Upload profile picture
  const handleUploadPicture = async () => {
    if (!selectedFile) {
      setNotice("Please select an image first.");
      return;
    }

    setUploading(true);
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/profile/image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to upload profile picture."
        );
      }

      setProfile((previous) =>
        previous
          ? { ...previous, image: data.user.image }
          : previous
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setNotice("Profile picture uploaded successfully!");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to upload profile picture."
      );
    } finally {
      setUploading(false);
    }
  };

  // Update name and bio
  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      setNotice("Name is required.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          bio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Profile update failed.");
      }

      setProfile((previous) =>
        previous
          ? { ...previous, ...data.user }
          : previous
      );

      setName(data.user.name);
      setBio(data.user.bio || "");
      setEditing(false);
      setNotice("Profile updated successfully!");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading profile...</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-center">
        <p className="text-red-600">
          {notice || "Profile not found."}
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-indigo-600"
        >
          Back to Home
        </button>
      </main>
    );
  }

  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const previewUrl = selectedFile
    ? URL.createObjectURL(selectedFile)
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">

        <button
          onClick={() => router.push("/")}
          className="mb-6 text-sm font-semibold text-indigo-600"
        >
          ← Back to Home
        </button>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          {/* Profile Information */}
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">

            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-indigo-100 bg-indigo-100 text-3xl font-bold text-indigo-700">

              {previewUrl || profile.image ? (
                <img
                  src={previewUrl || profile.image || ""}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials || "U"
              )}

            </div>

            <div className="mt-4 sm:ml-6 sm:mt-0">
              <h1 className="text-2xl font-bold text-slate-900">
                {profile.name}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                @{profile.username}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {profile.email}
              </p>

              <p className="mt-3 text-sm text-slate-600">
                {profile.bio || "No bio added yet."}
              </p>
            </div>
          </div>

          {/* Profile Picture Upload */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h2 className="font-bold text-slate-900">
              Profile Picture
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Upload a JPG, PNG or WEBP image. Maximum size: 5 MB.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2.5 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />

            {selectedFile && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">
                  Selected: {selectedFile.name}
                </p>

                <button
                  onClick={handleUploadPicture}
                  disabled={uploading}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload Picture"}
                </button>
              </div>
            )}
          </div>

          {/* Post, Followers and Following Counts */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{posts.length}</p>
                <p className="text-sm text-slate-500">Posts</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenFollowList("followers")}
                className="rounded-lg px-2 py-1 transition hover:bg-slate-50"
              >
                <p className="text-2xl font-bold text-slate-900">{followersCount}</p>
                <p className="text-sm text-slate-500">Followers</p>
              </button>
              <button
                type="button"
                onClick={() => handleOpenFollowList("following")}
                className="rounded-lg px-2 py-1 transition hover:bg-slate-50"
              >
                <p className="text-2xl font-bold text-slate-900">{followingCount}</p>
                <p className="text-sm text-slate-500">Following</p>
              </button>
            </div>

            <button
              onClick={() => {
                setEditing(!editing);
                setNotice("");
              }}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {editing ? "Cancel Editing" : "Edit Profile"}
            </button>
          </div>

          {/* Followers / Following List */}
          {followListType && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900">
                  {followListType === "followers" ? "Followers" : "Following"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setFollowListType(null);
                    setFollowUsers([]);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-white"
                >
                  Close
                </button>
              </div>

              {loadingFollowUsers ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  Loading users...
                </p>
              ) : followUsers.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  No users in this list yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {followUsers.map((user) => {
                    const userInitials = user.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 rounded-xl bg-white p-3"
                      >
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                            {userInitials || "U"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Edit Profile Form */}
          {editing && (
            <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Full Name
                </label>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Bio
                </label>

                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={300}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  placeholder="Tell people about yourself..."
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {bio.length}/300 characters
                </p>
              </div>

              <button
                onClick={handleUpdateProfile}
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {/* Status Message */}
          {notice && (
            <p
              aria-live="polite"
              className="mt-4 text-sm text-indigo-700"
            >
              {notice}
            </p>
          )}

        </section>

        {/* My Posts */}
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            My Posts
          </h2>

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-semibold text-slate-700">
                No posts yet.
              </p>

              <button
                onClick={() => router.push("/")}
                className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white"
              >
                Create a Post
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="whitespace-pre-wrap text-slate-800">
                    {post.content}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-5 border-t border-slate-100 pt-3 text-sm text-slate-500">
                    <span>❤️ {post._count.likes} Likes</span>
                    <span>💬 {post._count.comments} Comments</span>
                    <span>
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
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
