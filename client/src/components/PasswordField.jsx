import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

/**
 * Drop-in replacement for a <label>...<input type="password" /></label>
 * pair. Keeps the same markup/behaviour the app already uses elsewhere,
 * just with a show/hide toggle that never submits the form.
 */
export default function PasswordField({
  label,
  value,
  onChange,
  required = false,
  minLength,
  placeholder,
  name,
  autoComplete
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <div className="password-field">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
