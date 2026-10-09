import type { Metadata } from "next";
import { MusicIcon } from "lucide-react";

import { ComingSoon } from "@/components/features/coming-soon";
import { requireClubPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sangbog" };

/** Sangbog: placeholder until the songbook is built (SPEC §9.6, §16.3). */
export default async function SongsPage({ params }: PageProps<"/c/[clubId]/songs">) {
  const { clubId } = await params;
  await requireClubPage(clubId);

  return (
    <ComingSoon
      title="Sangbog"
      icon={<MusicIcon />}
      headline="Sangbogen bliver lige stemt 🎵"
      description="Den kommer snart. Så har I klubbens sange lige ved hånden, også midt i smagningen."
    />
  );
}
