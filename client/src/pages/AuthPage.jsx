import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { request } from '../api';
export default function AuthPage({ signup = false, onLogin }) {
  const [fields, setFields] = useState({ email: '', name: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) found.email = 'E-mail không hợp lệ.';
    if (signup && (fields.name.trim().length < 2 || fields.name.trim().length > 80)) found.name = 'Tên cần từ 2 đến 80 ký tự.';
    if (fields.password.length < 6 || new TextEncoder().encode(fields.password).length > 72) found.password = 'Mật khẩu cần ít nhất 6 ký tự và tối đa 72 byte.';
    setErrors(found); setMessage('');
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const data = await request(signup ? '/auth/signup' : '/auth/login', { method: signup ? 'PUT' : 'POST', body: fields });
      if (signup) navigate('/login', { state: { signupSuccess: true } }); else onLogin(data);
    } catch (error) { setMessage(error.message); setErrors(error.fields || {}); }
    finally { setBusy(false); }
  }
  // Các trang có key riêng, tránh giữ lại mật khẩu khi chuyển Login/Signup.
  return <form className="auth-form" onSubmit={submit} noValidate>
    <h1 className="sr-only">{signup ? 'Signup' : 'Login'}</h1>
    {location.state?.signupSuccess && !signup && <p role="status">Đăng ký thành công. Hãy đăng nhập.</p>}
    {message && <p className="error" role="alert">{message}</p>}
    {['email', ...(signup ? ['name'] : []), 'password'].map(field => <div className="field" key={field}>
      <label htmlFor={field}>{ { email: 'YOUR E-MAIL', name: 'YOUR NAME', password: 'PASSWORD' }[field]}</label>
      <input id={field} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} autoComplete={field === 'password' ? (signup ? 'new-password' : 'current-password') : field} value={fields[field]} onChange={e => setFields({ ...fields, [field]: e.target.value })} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} />
      {errors[field] && <small className="error" id={`${field}-error`}>{errors[field]}</small>}
    </div>)}
    <button className="primary" disabled={busy}>{busy ? 'Đang xử lý…' : signup ? 'SIGNUP' : 'LOGIN'}</button>
  </form>;
}
