/** Saves text to the user's computer as a file, using a temporary download link. */
export function downloadTextFile(
  fileName: string,
  text: string,
  mimeType = 'application/json',
): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);

  // Browsers only save files from a click on a link, so make a temporary one.
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
