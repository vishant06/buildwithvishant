// A tiny in-memory stand-in for Mongoose models, enough for the document controllers: it
// really applies the filters the controllers send (equality, $in, $ne, $nor, $or, $gt/$gte/$lt,
// dotted paths, a simple $text), so the tests prove WHICH documents each query can return.
const get = (row, path) => {
  const [head, ...rest] = path.split('.');
  const value = row?.[head];
  if (!rest.length) return Array.isArray(value) ? value : [value];
  return (Array.isArray(value) ? value : [value]).flatMap((item) => (item == null ? [] : get(item, rest.join('.'))));
};
const same = (a, b) => String(a) === String(b);

export const matches = (row, filter = {}) =>
  Object.entries(filter).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (key === '$or') return cond.some((f) => matches(row, f));
    if (key === '$nor') return !cond.some((f) => matches(row, f));
    if (key === '$text') {
      const terms = String(cond.$search).toLowerCase().split(/\s+/).filter(Boolean);
      const hay = ['title', 'description', 'subject', 'topic', 'tags', 'ownerName'].map((k) => [].concat(row[k] ?? []).join(' ')).join(' ').toLowerCase();
      return terms.some((t) => hay.includes(t));
    }
    const values = get(row, key);
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === '$ne') return !values.some((v) => same(v, arg));
        if (op === '$in') return values.some((v) => arg.some((a) => same(v, a)));
        if (op === '$nin') return !values.some((v) => arg.some((a) => same(v, a)));
        if (op === '$gt') return values.some((v) => v > arg);
        if (op === '$gte') return values.some((v) => v >= arg);
        if (op === '$lt') return values.some((v) => v < arg);
        if (op === '$exists') return values.some((v) => v !== undefined) === arg;
        return false; // unknown operator: matches nothing (never silently broadens a query)
      });
    }
    return values.some((v) => same(v, cond));
  });

const clone = (row) => JSON.parse(JSON.stringify(row));

export const makeModel = (store = [], defaults = {}) => {
  const rows = store;
  class Model {
    constructor(data) { Object.assign(this, JSON.parse(JSON.stringify(defaults)), data); }
    async save() {
      const data = Object.fromEntries(Object.entries(this).filter(([, v]) => typeof v !== 'function'));
      const index = rows.findIndex((r) => same(r._id, data._id));
      if (index >= 0) Object.assign(rows[index], data, { updatedAt: new Date() }); else rows.push({ createdAt: new Date(), updatedAt: new Date(), ...data });
      return this;
    }
    toObject() { return clone(Object.fromEntries(Object.entries(this).filter(([, v]) => typeof v !== 'function'))); }
    async deleteOne() { Model.deleteOne({ _id: this._id }); }
    static get rows() { return rows; }
    static reset() { rows.length = 0; }
    static hydrate(row) { return Object.assign(new Model({}), row); }
    static find(filter) {
      let out = rows.filter((r) => matches(r, filter));
      let lean = false;
      const chain = {
        select: () => chain,
        sort: (spec) => { const [[k, d]] = Object.entries(spec).filter(([, v]) => v === 1 || v === -1); out = [...out].sort((a, b) => (a[k] > b[k] ? d : a[k] < b[k] ? -d : 0)); return chain; },
        skip: (n) => { out = out.slice(n); return chain; },
        limit: (n) => { out = out.slice(0, n); return chain; },
        lean: () => { lean = true; return chain; },
        then: (ok, bad) => Promise.resolve(out.map((r) => (lean ? clone(r) : Model.hydrate(r)))).then(ok, bad)
      };
      return chain;
    }
    static async findOne(filter) { const r = rows.find((row) => matches(row, filter)); return r ? Model.hydrate(r) : null; }
    static async findById(id) { return Model.findOne({ _id: id }); }
    static async countDocuments(filter) { return rows.filter((r) => matches(r, filter)).length; }
    static async create(data) { const doc = new Model({ _id: String(rows.length + 1).padStart(24, '0'), ...data }); await doc.save(); return doc; }
    static async insertMany(list) { return Promise.all(list.map((d) => Model.create(d))); }
    static async deleteOne(filter) { const i = rows.findIndex((r) => matches(r, filter)); if (i >= 0) rows.splice(i, 1); return {}; }
    static async deleteMany(filter) { for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], filter)) rows.splice(i, 1); return {}; }
    static async findOneAndDelete(filter) { const r = rows.find((row) => matches(row, filter)); if (!r) return null; Model.deleteOne({ _id: r._id }); return Model.hydrate(r); }
    static async findOneAndUpdate(filter, update, options = {}) {
      let r = rows.find((row) => matches(row, filter));
      if (!r && options.upsert) { r = { _id: String(rows.length + 1).padStart(24, '0'), ...filter }; rows.push(r); }
      if (!r) return null;
      for (const [k, v] of Object.entries(update.$inc || {})) r[k] = (r[k] || 0) + v;
      Object.assign(r, update.$set || {}, Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$'))));
      return Model.hydrate(r);
    }
    static async updateOne(filter, update) {
      const r = rows.find((row) => matches(row, filter));
      if (!r) return { modifiedCount: 0 };
      for (const [k, v] of Object.entries(update.$inc || {})) r[k] = (r[k] || 0) + v;
      Object.assign(r, update.$set || {}, Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$'))));
      return { modifiedCount: 1 };
    }
    static async updateMany(filter, update) {
      let n = 0;
      for (const r of rows.filter((row) => matches(row, filter))) {
        for (const [k, v] of Object.entries(update.$pull || {})) r[k] = (r[k] || []).filter((x) => !same(x, v));
        for (const [k, v] of Object.entries(update.$addToSet || {})) if (!(r[k] || []).includes(v)) r[k] = [...(r[k] || []), v];
        Object.assign(r, update.$set || {}, Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$'))));
        n += 1;
      }
      return { modifiedCount: n };
    }
    static async aggregate() { return []; }
  }
  return Model;
};

// A valid, tiny PDF with real text on each page (built by hand so tests need no PDF library).
export const makePdf = (pages = ['Hello world'], { extra = '', trailer = true } = {}) => {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PAGES');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (const text of pages) {
    const stream = `BT /F1 12 Tf 40 700 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> ${extra} >>`));
  }
  objs[1] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n${trailer ? '%%EOF' : ''}\n`;
  return Buffer.from(out, 'latin1');
};
