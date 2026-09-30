// The API helper now lives in shared/ so the main site, Playground and AI use
// exactly one implementation. Re-exported here so every existing
// `import request from '../services/api.js'` keeps working unchanged.
export { default, absoluteAsset, downloadNotePdf } from '@shared/api/request.js';
