import OtherUserProfileClient from "./OtherUserProfileClient";

export const instant = false;

export default async function OtherUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OtherUserProfileClient userId={id} />;
}