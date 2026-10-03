import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { request } from './api';
import AuthPage from './pages/AuthPage';
import Feed from './pages/Feed';
import PostDetail from './pages/PostDetail';
const SESSION_KEY = 'lab23.auth';
function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; } }
export default function App() {
  const [session, setSession] = useState(readSession);
  const [checking, setChecking] = useState(!!session);
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const logout = useCallback(() => { localStorage.removeItem(SESSION_KEY); setSession(null); setChecking(false); navigate('/login'); }, [navigate]);
  useEffect(() => {
    const expired = () => { logout(); setNotice('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); };
    window.addEventListener('auth-expired', expired);
    return () => window.removeEventListener('auth-expired', expired);
  }, [logout]);
  useEffect(() => {
    if (!session?.token) { setChecking(false); return; }
    const controller = new AbortController();
    request('/auth/me', { token: session.token, signal: controller.signal })
      .then(({ user }) => setSession(previous => previous ? { ...previous, user } : null))
      .catch(error => { if (error.name !== 'AbortError' && error.status !== 401) setNotice(error.message); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [session?.token]);
  function login(data) { const value = { token: data.token, user: data.user }; localStorage.setItem(SESSION_KEY, JSON.stringify(value)); setSession(value); setNotice(''); navigate('/'); }
  function updateUser(user) { const value = { ...session, user }; setSession(value); localStorage.setItem(SESSION_KEY, JSON.stringify(value)); }
  const protect = element => session ? (checking ? <p className="center">Đang kiểm tra tài khoản…</p> : element) : <Navigate to="/login" replace />;
  return <>
    <header><NavLink to="/" className="brand">MessageNode</NavLink><nav>{session ? <><NavLink to="/" end>Feed</NavLink><button className="nav-button" onClick={logout}>Logout</button></> : <><NavLink to="/login">Login</NavLink><NavLink to="/signup">Signup</NavLink></>}</nav></header>
    <main>{notice && <div className="notice" role="status">{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <AuthPage key="login" onLogin={login} />} />
        <Route path="/signup" element={session ? <Navigate to="/" replace /> : <AuthPage key="signup" signup onLogin={login} />} />
        <Route path="/" element={protect(<Feed session={session} onUserChange={updateUser} />)} />
        <Route path="/posts/:id" element={protect(<PostDetail session={session} />)} />
        <Route path="*" element={<div className="center"><h1>Không tìm thấy trang</h1><NavLink to="/">Về Feed</NavLink></div>} />
      </Routes>
    </main>
  </>;
}
