import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Write the file to the app's cache and open the Android share sheet on it (save to Files,
 * Drive, email). Resolves 'cancelled' when the user dismisses the sheet; other failures throw.
 * Only imported by the native build.
 */
export async function shareNative(name: string, text: string): Promise<'shared' | 'cancelled'> {
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  try {
    await Share.share({ title: name, files: [uri] })
    return 'shared'
  } catch (e) {
    // The plugin rejects with this message, not an error code, when the sheet is dismissed.
    if (e instanceof Error && /cancel/i.test(e.message)) return 'cancelled'
    throw e
  }
}
