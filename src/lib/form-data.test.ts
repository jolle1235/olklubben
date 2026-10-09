import { describe, expect, it } from "vitest";

import { readFormValues } from "./form-data";

function form(entries: [string, string | Blob][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("readFormValues", () => {
  it("tager tekstværdier og den første af gentagne nøgler, men ingen filer", () => {
    const data = form([
      ["email", "a@b.dk"],
      ["email", "andet@b.dk"],
      ["fil", new Blob(["x"])],
      ["tom", ""],
    ]);

    expect(readFormValues(data)).toEqual({ email: "a@b.dk", tom: "" });
  });

  it("samler listefelter i rækkefølge og giver [] for et manglende", () => {
    const data = form([
      ["hostIds", "a"],
      ["title", "Ølsmagning #1"],
      ["hostIds", "b"],
      ["hostIds", "a"],
    ]);

    expect(readFormValues(data, { arrays: ["hostIds", "tags"] })).toEqual({
      title: "Ølsmagning #1",
      hostIds: ["a", "b", "a"],
      tags: [],
    });
  });

  it("stopper en lang liste ved loftet + 1, så schemaets max stadig slår til", () => {
    const data = form(Array.from({ length: 500 }, (_, index) => ["hostIds", `id-${index}`]));

    const values = readFormValues(data, { arrays: ["hostIds"], maxArrayLength: 20 });
    expect(values.hostIds).toHaveLength(21);
    expect(values.hostIds?.[20]).toBe("id-20");
    expect(readFormValues(data, { arrays: ["hostIds"] }).hostIds).toHaveLength(51);
  });

  it("udelader felter i exclude, også listefelter", () => {
    const data = form([
      ["email", "a@b.dk"],
      ["password", "hemmelig"],
      ["confirmPassword", "hemmelig"],
      ["hostIds", "a"],
    ]);

    expect(
      readFormValues(data, {
        arrays: ["hostIds"],
        exclude: ["password", "confirmPassword", "hostIds"],
      }),
    ).toEqual({ email: "a@b.dk" });
  });

  it("behandler navne som constructor og __proto__ som almindelige felter", () => {
    const data = form([
      ["constructor", "x"],
      ["__proto__", "y"],
    ]);

    const values = readFormValues(data);
    expect(Object.hasOwn(values, "constructor")).toBe(true);
    expect(values.constructor).toBe("x");
    expect(Object.hasOwn(values, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype);
  });
});
