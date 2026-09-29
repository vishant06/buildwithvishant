import { absoluteAsset } from '../../services/api.js';

export default function ImageBlock({ url = '', alt = '', caption = '' }) {
  if (!url) return null;
  return (
    <figure className="note-block-image">
      <img src={absoluteAsset(url)} alt={alt || caption || ''} loading="lazy" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
