/**
 * Strip diacritics: "función detección" → "funcion deteccion".
 * NFD splits a letter from its combining mark, then the marks drop.
 *
 * Lives in utils (not wiki/_shared, where it started) because retrieval
 * needs it too: FTS5's unicode61 tokenizer indexes with
 * remove_diacritics, so query keywords must be deburred the same way or
 * accented Spanish prompts silently miss.
 */
export function deburr(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
