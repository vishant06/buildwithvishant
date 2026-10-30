// Metadata fields shared by the upload form and the edit dialog.
const label = (id) => ({ javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP', kotlin: 'Kotlin', web: 'HTML / CSS / JS' })[id] || id;

export default function DocumentFields({ values, errors = {}, onChange, config, disabled }) {
  const set = (name) => (event) => onChange(name, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
  const field = (name, text, props = {}) => (
    <label>
      {text}
      <input value={values[name] || ''} onChange={set(name)} disabled={disabled} aria-invalid={Boolean(errors[name])} {...props} />
      {errors[name] && <span className="nd-err" role="alert">{errors[name]}</span>}
    </label>
  );
  return (
    <>
      {field('title', 'Title *', { maxLength: 140, required: true })}
      <label>
        Description *
        <textarea value={values.description || ''} onChange={set('description')} maxLength={1000} required disabled={disabled} aria-invalid={Boolean(errors.description)} />
        <small>What the notes cover and who they are for (10-1000 characters).</small>
        {errors.description && <span className="nd-err" role="alert">{errors.description}</span>}
      </label>
      <div className="row">
        {field('subject', 'Subject *', { maxLength: 80, required: true, placeholder: 'e.g. Data Structures' })}
        <label>
          Category *
          <select value={values.category || ''} onChange={set('category')} disabled={disabled} required aria-invalid={Boolean(errors.category)}>
            <option value="">Choose…</option>
            {(config?.categories || []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {errors.category && <span className="nd-err" role="alert">{errors.category}</span>}
        </label>
      </div>
      <div className="row">
        {field('topic', 'Topic', { maxLength: 80, placeholder: 'e.g. Recursion' })}
        {field('tags', 'Tags', { placeholder: 'comma separated, up to 8' })}
      </div>
      {errors.tags && <span className="nd-err" role="alert">{errors.tags}</span>}

      <fieldset>
        <legend>Academic details (optional)</legend>
        <div className="row">
          {field('university', 'University', { maxLength: 100 })}
          {field('course', 'Course', { maxLength: 100 })}
          {field('semester', 'Semester', { maxLength: 30 })}
          {field('subjectCode', 'Subject code', { maxLength: 30 })}
        </div>
        <small>Notes are community-contributed and are not official university material.</small>
      </fieldset>

      <fieldset>
        <legend>Code example for the Playground (optional)</legend>
        <small>If your notes include a program, add it here so readers can open it in the Playground. It is only copied into a new, unsaved workspace and is never run automatically.</small>
        <div className="row">
          {field('codeTitle', 'Example name', { maxLength: 100 })}
          <label>
            Language
            <select value={values.codeLanguage || ''} onChange={set('codeLanguage')} disabled={disabled}>
              <option value="">Choose…</option>
              {(config?.codeLanguages || []).map((id) => <option key={id} value={id}>{label(id)}</option>)}
            </select>
            {errors.codeLanguage && <span className="nd-err" role="alert">{errors.codeLanguage}</span>}
          </label>
        </div>
        <label>
          Code
          <textarea value={values.code || ''} onChange={set('code')} maxLength={config?.maxCodeChars || 20000} disabled={disabled} spellCheck={false} style={{ fontFamily: 'monospace', minHeight: 140 }} />
          {errors.code && <span className="nd-err" role="alert">{errors.code}</span>}
        </label>
      </fieldset>

      <div className="row">
        <label>
          Who can read it after approval
          <select value={values.visibility || 'public'} onChange={set('visibility')} disabled={disabled}>
            <option value="public">Public: listed and searchable</option>
            <option value="unlisted">Unlisted: only people with the link</option>
            <option value="private">Private: only me</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={values.downloadable !== false} onChange={set('downloadable')} disabled={disabled} />
          <span>Allow signed-in readers to download the PDF</span>
        </label>
      </div>
    </>
  );
}

export const emptyValues = { title: '', description: '', subject: '', category: '', topic: '', tags: '', university: '', course: '', semester: '', subjectCode: '', codeTitle: '', codeLanguage: '', code: '', visibility: 'public', downloadable: true };

export const valuesFromDocument = (doc) => ({
  ...emptyValues,
  title: doc.title, description: doc.description, subject: doc.subject, category: doc.category, topic: doc.topic || '', tags: (doc.tags || []).join(', '),
  university: doc.university || '', course: doc.course || '', semester: doc.semester || '', subjectCode: doc.subjectCode || '',
  visibility: doc.visibility || 'public', downloadable: doc.downloadable !== false
});
