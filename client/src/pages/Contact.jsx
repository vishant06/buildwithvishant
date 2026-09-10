import { Send } from 'lucide-react';
import { useState } from 'react';
import SectionHeader from '../components/SectionHeader.jsx';
import request from '../services/api.js';

const initialForm = { name: '', email: '', subject: '', message: '' };

const Contact = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      await request('/contact', { method: 'POST', body: JSON.stringify(form) });
      setStatus('Message sent successfully. Thank you for reaching out.');
      setForm(initialForm);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <SectionHeader eyebrow="Contact" title="Let us build something clean">
        Send a message directly to Vishant Kumar. The backend saves the inquiry in MongoDB and sends an email notification.
      </SectionHeader>
      <form className="form panel" onSubmit={submit}>
        <div className="form-grid">
          <label>Name<input name="name" value={form.name} onChange={updateField} required /></label>
          <label>Email<input type="email" name="email" value={form.email} onChange={updateField} required /></label>
        </div>
        <label>Subject<input name="subject" value={form.subject} onChange={updateField} required /></label>
        <label>Message<textarea name="message" rows="6" value={form.message} onChange={updateField} required /></label>
        <button className="btn primary" disabled={loading}>
          <Send size={18} /> {loading ? 'Sending...' : 'Send Message'}
        </button>
        {status && <p className="notice">{status}</p>}
      </form>
    </section>
  );
};

export default Contact;
