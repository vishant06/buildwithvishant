import { Send } from 'lucide-react';
import { useState } from 'react';
import request from '../services/api.js';

const initialForm = { name: '', email: '', subject: '', message: '' };

const ContactSection = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('');
  const [statusVariant, setStatusVariant] = useState('success'); // 'success' | 'error'
  const [loading, setLoading] = useState(false);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      const data = await request('/contact', { method: 'POST', body: JSON.stringify(form) });
      setStatusVariant('success');
      setStatus(data?.message || 'Message sent successfully. Thank you for reaching out.');
      setForm(initialForm);
    } catch (error) {
      setStatusVariant('error');
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="home-section" id="contact">
      <div className="home-section-head">
        <div>
          <span className="eyebrow">Get in Touch</span>
          <h2 className="home-section-title">Let&apos;s build something clean</h2>
          <p>
            Send a message directly to Vishant Kumar. The backend saves the
            inquiry in MongoDB and sends an email notification.
          </p>
        </div>
      </div>
      <form className="form panel" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Name
            <input name="name" value={form.name} onChange={updateField} required />
          </label>
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={updateField} required />
          </label>
        </div>
        <label>
          Subject
          <input name="subject" value={form.subject} onChange={updateField} required />
        </label>
        <label>
          Message
          <textarea name="message" rows="6" value={form.message} onChange={updateField} required />
        </label>
        <button className="btn primary" disabled={loading}>
          <Send size={18} /> {loading ? 'Sending...' : 'Send Message'}
        </button>
        {status && <p className={`notice ${statusVariant}`}>{status}</p>}
      </form>
    </section>
  );
};

export default ContactSection;
