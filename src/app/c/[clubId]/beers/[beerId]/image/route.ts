import { getSession } from "@/server/auth/session";
import { beerThumbnail } from "@/server/beers/image";
import { getBeerImageForMember } from "@/server/beers/queries";

/**
 * A beer's photo (SPEC §9.5, D-158), only for members of the beer's club. No
 * session, not a member, another club's beer or no photo: the same 404
 * (§4.4). `?size=thumb` is the list cards' 112 px copy, made on the fly. The
 * URL carries ?v=<updatedAt> (beerImageHref), so the response may be cached
 * privately for a year; a new photo gets a new URL.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/c/[clubId]/beers/[beerId]/image">,
): Promise<Response> {
  const { clubId, beerId } = await params;
  const session = await getSession();
  const image = session ? await getBeerImageForMember(clubId, beerId, session.user.id) : null;
  if (!image) return new Response("Ikke fundet", { status: 404 });

  const thumb = new URL(request.url).searchParams.get("size") === "thumb";
  const body = thumb ? await beerThumbnail(image.data) : image.data;
  return new Response(body as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
