import { useState } from 'react';
import usePosts from '../hooks/usePosts';
import { Link } from 'react-router-dom';
import { request } from '../api';
import PostForm from '../components/PostForm';
export default function Feed({ session, onUserChange }) {
  const { posts, loading, loadError, loadPosts, savePost, connection } = usePosts(session.token);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [status, setStatus] = useState(session.user.status || '');
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleting, setDeleting] = useState('');
  async function updateStatus(event) {
    event.preventDefault(); setStatusBusy(true); setError(''); setNotice('');
    try { const data = await request('/auth/status', { token: session.token, method: 'PATCH', body: { status: status.trim() } }); onUserChange({ ...session.user, status: data.status }); setNotice(data.message); }
    catch (failure) { setError(failure.message); } finally { setStatusBusy(false); }
  }
  async function remove(post) {
    if (!window.confirm(`Xóa bài viết “${post.title}”?`)) return;
    setDeleting(post._id); setError(''); setNotice('');
    try { const data = await request(`/feed/post/${post._id}`, { token: session.token, method: 'DELETE' }); loadPosts(); setNotice(data.message); }
    catch (failure) { setError(failure.message); } finally { setDeleting(''); }
  }
  function saved(post) { savePost(post, !!editor.post); setEditor(null); setNotice('Đã lưu bài viết.'); }
  return <section className="feed">
    <h1 className="sr-only">Feed</h1>
    <p className="connection" role="status">{connection === 'connected' ? 'Đã kết nối realtime' : connection === 'connecting' ? 'Đang kết nối realtime…' : 'Mất kết nối realtime — đang kết nối lại…'}</p>
    <form className="status-form" onSubmit={updateStatus}><label className="sr-only" htmlFor="status">Trạng thái của bạn</label><input id="status" value={status} onChange={e => setStatus(e.target.value)} maxLength={140} required /><button className="text-button" disabled={statusBusy || !status.trim()}>{statusBusy ? 'Đang lưu…' : 'UPDATE'}</button></form>
    <div className="center"><button className="accent" onClick={() => { setEditor({ post: null }); setNotice(''); }}>NEW POST</button></div>
    {(error || loadError) && <div className="error" role="alert">{error || loadError} <button className="text-button" onClick={() => { setError(''); loadPosts(); }}>Thử lại</button></div>}
    {notice && <p className="center" role="status">{notice}</p>}
    {loading ? <p className="center">Đang tải bài viết…</p> : !error && !loadError && posts.length === 0 ? <p className="center">No posts found.</p> : posts.map(post => <article className="post-card" key={post._id}>
      <p className="metadata">Posted by {post.creator.name} on {new Date(post.createdAt).toLocaleDateString('vi-VN')}</p><h2>{post.title}</h2>
      <div className="actions"><Link className="text-button" to={`/posts/${post._id}`}>VIEW</Link>{String(post.creator._id) === String(session.user._id) && <><button className="text-button" onClick={() => setEditor({ post })}>EDIT</button><button className="text-button danger" disabled={!!deleting} onClick={() => remove(post)}>{deleting === post._id ? 'Đang xóa…' : 'DELETE'}</button></>}</div>
    </article>)}
    {editor && <PostForm post={editor.post} token={session.token} onClose={() => setEditor(null)} onSaved={saved} />}
  </section>;
}
