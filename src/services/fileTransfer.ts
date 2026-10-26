/**
 * Hand a file to the user without any network: the share sheet on phones (save to Files,
 * AirDrop, email to yourself) and a plain download elsewhere.
 */
export async function saveFile(
  name: string,
  text: string,
  mime = 'application/json',
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], name, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Some browsers advertise file sharing but refuse at runtime; fall back to download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
