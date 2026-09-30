/* Dateien ausgeben: im Browser als Download, in der Android-App über das Teilen-Menü */
'use strict';

const FileOut = (() => {
  const cap = () => window.Capacitor;
  const isNative = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  function browserDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  /** Android: Datei im App-Cache ablegen und Teilen-Menü öffnen (Speichern, E-Mail, WhatsApp …). */
  async function nativeShare(blob, filename, title) {
    const { Filesystem, Share } = cap().Plugins;
    const res = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: 'CACHE' });
    await Share.share({ title, url: res.uri, dialogTitle: title });
  }

  /** Datei speichern: Download im Browser, Teilen-Menü in der App. */
  async function save(blob, filename, title = filename) {
    if (isNative()) return nativeShare(blob, filename, title);
    browserDownload(blob, filename);
  }

  const canShareFiles = () => isNative() || !!navigator.canShare;

  /** Datei teilen: Teilen-Menü (App oder Browser mit Web Share API). */
  async function share(blob, filename, title = filename) {
    if (isNative()) return nativeShare(blob, filename, title);
    const file = new File([blob], filename, { type: blob.type });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) throw new Error('Teilen von Dateien wird auf diesem Gerät nicht unterstützt.');
    await navigator.share({ files: [file], title });
  }

  return { isNative, save, share, canShareFiles };
})();
