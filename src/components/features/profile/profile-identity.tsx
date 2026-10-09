import { UserAvatar } from "@/components/ui/user-avatar";
import { getDisplayName, officialNameSuffix } from "@/lib/format/display-name";

export type ProfileIdentityProps = {
  /** The official name. */
  name: string;
  nickname: string | null;
  email: string;
  image: string | null;
  /** Whether "Fortsæt med Google" is available, for the picture hint. */
  googleAvailable: boolean;
};

/**
 * Who you are logged in as (SPEC §9.8, D-105): the picture (from Google, or
 * the display name's initials), the display name large with the official
 * name after it when a nickname is set ("Kaptajnen (Jesper Thomsen)"), and
 * the email (read only: email change comes later, D-106).
 */
export function ProfileIdentity({
  name,
  nickname,
  email,
  image,
  googleAvailable,
}: ProfileIdentityProps) {
  const displayName = getDisplayName({ name, nickname });
  const officialName = officialNameSuffix({ name, nickname });
  const pictureHint = image
    ? "Dit profilbillede kommer fra din Google-konto."
    : googleAvailable
      ? "Logger du ind med Google, henter vi dit profilbillede derfra."
      : null;

  return (
    <section
      aria-label="Din konto"
      className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left"
    >
      <UserAvatar
        name={displayName}
        image={image}
        size="xl"
        decorative
        className="m-1.5 shrink-0"
      />
      <div className="grid max-w-full min-w-0 grid-cols-1">
        <p className="font-display text-2xl leading-tight font-semibold break-words hyphens-auto text-olive md:text-[1.75rem]">
          {displayName}
        </p>
        {officialName ? (
          <p className="mt-0.5 text-[1.05rem] break-words hyphens-auto text-muted-foreground">
            ({officialName})
          </p>
        ) : null}
        <p className="mt-1 text-[1.05rem] break-all text-ink">{email}</p>
        {pictureHint ? (
          <p className="mt-2 text-[0.95rem] text-muted-foreground">{pictureHint}</p>
        ) : null}
      </div>
    </section>
  );
}
