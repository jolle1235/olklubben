import { cn } from "@/lib/utils";
import {
  deriveChords,
  hasChords,
  parseSong,
  type SongLine,
  type SongStanza,
  type WordBox,
} from "@/server/domain/songs/song-text";

/**
 * A song's text (SPEC §9.6 "Læsevisning"), rendered from the song-text format
 * with parseSong(): stanzas, Danish section labels and, in the chords view,
 * the chord chips, chord rows and chords positioned over their words. Lyrics
 * are rendered ONLY as text (never innerHTML).
 *
 * No hooks, so it renders on the server in the reader and on the client in
 * the admin preview.
 *
 *   * mode "reader": BOTH views are rendered and CSS shows the one chosen on
 *     <html data-song-view> (the "Sangbog" block in globals.css), so the
 *     choice applies before the first paint. A song without chords renders
 *     one ungated view.
 *   * mode "chords": the chords view only, ungated (the admin preview shows
 *     exactly how every line was read).
 *
 * The font size comes from .song-text (html[data-song-size]).
 */
export type SongTextViewProps = {
  /** Song.body, already cleaned (cleanSongText). */
  body: string;
  mode?: "reader" | "chords";
  className?: string;
};

export function SongTextView({ body, mode = "reader", className }: SongTextViewProps) {
  const stanzas = parseSong(body);
  if (mode === "chords") {
    return (
      <div className={cn("song-text", className)}>
        <ChordsView stanzas={stanzas} chords={deriveChords(body)} />
      </div>
    );
  }
  if (!hasChords(body)) {
    return (
      <div className={cn("song-text", className)}>
        <LyricsView stanzas={stanzas} />
      </div>
    );
  }
  return (
    <div className={cn("song-text", className)}>
      <div className="song-view-lyrics">
        <LyricsView stanzas={stanzas} />
      </div>
      <div className="song-view-chords">
        <ChordsView stanzas={stanzas} chords={deriveChords(body)} />
      </div>
    </div>
  );
}

/** Tekst: lyric lines only. Instrumental stanzas (Intro, Solo …) and player notes are left out. */
function LyricsView({ stanzas }: { stanzas: SongStanza[] }) {
  return stanzas
    .filter((stanza) => !stanza.instrumental)
    .map((stanza, index) => (
      <Stanza key={index} stanza={stanza}>
        {stanza.lines.map((line, lineIndex) =>
          line.kind === "lyric" || line.kind === "pair" ? (
            <span key={lineIndex} className="song-line">
              {line.text}
            </span>
          ) : null,
        )}
      </Stanza>
    ));
}

/** Akkorder: the chords of the song, then every stanza with its chord rows, pairs and notes. */
function ChordsView({ stanzas, chords }: { stanzas: SongStanza[]; chords: string[] }) {
  return (
    <>
      {chords.length > 0 ? (
        <div className="mb-[1.1em] grid grid-cols-1 gap-1.5 font-sans">
          <p className="text-[0.95rem] font-semibold text-slate">Akkorder i sangen</p>
          <ul className="flex flex-wrap gap-1.5">
            {chords.map((chord) => (
              <li
                key={chord}
                className="rounded-md bg-harbor-tint px-2 py-0.5 text-base leading-snug font-semibold text-harbor"
              >
                {chord}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {stanzas.map((stanza, index) => (
        <Stanza key={index} stanza={stanza}>
          {stanza.lines.map((line, lineIndex) => (
            <ChordsLine key={lineIndex} line={line} />
          ))}
        </Stanza>
      ))}
    </>
  );
}

function Stanza({ stanza, children }: { stanza: SongStanza; children: React.ReactNode }) {
  const hasLines = stanza.lines.length > 0;
  return (
    <div className="song-stanza" data-repeated={stanza.repeated || undefined}>
      {stanza.label ? <h2 className="song-label">{stanza.label}</h2> : null}
      {hasLines ? <p>{children}</p> : null}
    </div>
  );
}

function ChordsLine({ line }: { line: SongLine }) {
  switch (line.kind) {
    case "note":
      return <span className="song-note">{line.text}</span>;
    case "chords":
      return (
        <span className="song-chord-row">
          <span className="sr-only">Akkorder: </span>
          {line.chords.join(" ")}
        </span>
      );
    case "pair":
      return <PairLine text={line.text} boxes={line.boxes} />;
    case "lyric":
      return <span className="song-line">{line.text}</span>;
  }
}

/**
 * A lyric line with chords over its syllables: one unbreakable box per word,
 * each piece a column with the chord above its fragment. Screen readers get
 * "Akkorder: G, C" and the plain line instead of the boxes.
 */
function PairLine({ text, boxes }: { text: string; boxes: WordBox[] }) {
  const chords = boxes.flatMap((box) =>
    box.pieces.flatMap((piece) => (piece.chord === null ? [] : [piece.chord])),
  );
  return (
    <span className="song-line song-pair">
      <span className="sr-only">Akkorder: {chords.join(", ")}. </span>
      <span aria-hidden>
        {boxes.map((box, boxIndex) => (
          <span key={boxIndex} className="song-word">
            {box.pieces.map((piece, pieceIndex) => (
              <span key={pieceIndex} className="song-piece">
                {piece.chord === null ? null : (
                  <span className={cn("song-chord", piece.hang && "song-chord-hang")}>
                    {piece.chord}
                  </span>
                )}
                <span className="song-piece-text">{piece.text}</span>
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
