// Picking a file to import and handing a file to the share sheet.

import { Platform } from 'react-native';

export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({
    // Any file: exports arrive as .csv, .txt or .json depending on the app and
    // on how they were saved, and the content is checked after reading.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  let text: string;
  if (Platform.OS === 'web') {
    const file = (asset as { file?: Blob }).file;
    text = file ? await file.text() : await (await fetch(asset.uri)).text();
  } else {
    const FS = require('expo-file-system') as typeof import('expo-file-system');
    text = await new FS.File(asset.uri).text();
  }
  return { name: asset.name, text };
}

export async function shareTextFile(name: string, text: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const FS = require('expo-file-system') as typeof import('expo-file-system');
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const file = new FS.File(FS.Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name, UTI: mime === 'application/json' ? 'public.json' : 'public.comma-separated-values-text' });
}
