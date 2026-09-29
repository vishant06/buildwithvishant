import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// ImagePicker's own `quality` option compresses but doesn't resize — a
// modern phone photo (12MP+) can still land well over the backend's 2-3MB
// upload limits even at quality 0.6. Actually resizing the longest edge
// down to something screen/avatar-appropriate fixes this reliably, and is
// the likely real cause of "avatar upload problems" on real devices (the
// backend was silently rejecting oversized files with a 400).
export const prepareImageForUpload = async (asset, maxWidth = 1024) => {
  const context = ImageManipulator.manipulate(asset.uri);
  const rendered = await context.resize({ width: maxWidth }).renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });

  context.release?.();
  rendered.release?.();

  return {
    uri: result.uri,
    fileName: `${(asset.fileName || "photo").replace(/\.[^/.]+$/, "")}.jpg`,
    mimeType: "image/jpeg",
  };
};
