import { UserAvatar } from "@/components/ui/user-avatar";

export type ProfileIdentityProps = {
  name: string;
  email: string;
  image: string | null;
  /** Whether "Fortsæt med Google" is available, for the picture hint. */
  googleAvailable: boolean;
};

/**
 * Who you are logged in as: picture, name and email (SPEC §9.8). The picture
 * comes from Google (round 1 has no upload).
 */
export function ProfileIdentity({ name, email, image, googleAvailable }: ProfileIdentityProps) {
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
      <UserAvatar name={name} image={image} size="xl" decorative className="m-1.5 shrink-0" />
      <div className="max-w-full min-w-0">
        <p className="font-display text-2xl leading-tight font-semibold break-words text-olive md:text-[1.75rem]">
          {name}
        </p>
        <p className="mt-1 text-[1.05rem] break-all text-ink">{email}</p>
        {pictureHint ? (
          <p className="mt-2 text-[0.95rem] text-muted-foreground">{pictureHint}</p>
        ) : null}
      </div>
    </section>
  );
}
