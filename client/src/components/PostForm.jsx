import { useEffect, useRef, useState } from 'react';
import { imageUrl, request } from '../api';
export default function PostForm({ post, token, onClose, onSaved }) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(post ? imageUrl(post.imageUrl) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => {
    if (!file) { setPreview(post ? imageUrl(post.imageUrl) : ''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, post]);
  const valid = title.trim().length >= 5 && title.trim().length <= 120 && content.trim().length >= 5 && content.trim().length <= 10000 && (!!file || !!post);
  function selectFile(event) {
    const selected = event.target.files[0]; setError('');
    if (selected && (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024)) { setFile(null); event.target.value = ''; setError('Chọn ảnh PNG, JPEG hoặc WebP tối đa 5 MB.'); return; }
    setFile(selected || null);
  }
  async function submit(event) {
    event.preventDefault(); if (!valid || busy) return;
    setBusy(true); setError('');
    const body = new FormData(); body.append('title', title.trim()); body.append('content', content.trim()); if (file) body.append('image', file);
    try { const data = await request(post ? `/feed/post/${post._id}` : '/feed/post', { token, method: post ? 'PUT' : 'POST', body }); onSaved(data.post); }
    catch (failure) { setError([failure.message, ...Object.values(failure.fields || {})].join(' ')); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="post-form-title">
    <h2 id="post-form-title">{post ? 'Edit Post' : 'New Post'}</h2>
    <form onSubmit={submit}>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="field"><label htmlFor="post-title">TITLE</label><input autoFocus id="post-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required minLength={5} /><small>Tiêu đề từ 5 đến 120 ký tự.</small></div>
      <div className="field"><label htmlFor="post-image">IMAGE</label><input id="post-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} /><small>{post ? 'Giữ ảnh hiện tại hoặc chọn ảnh mới.' : 'Please choose an image.'} PNG, JPEG, WebP · tối đa 5 MB.</small></div>
      <div className="image-preview">{preview && <img src={preview} alt="Ảnh xem trước của bài viết" />}</div>
      <div className="field"><label htmlFor="post-content">CONTENT</label><textarea id="post-content" value={content} onChange={e => setContent(e.target.value)} required minLength={5} maxLength={10000} rows={5} /><small>Nội dung từ 5 đến 10000 ký tự.</small></div>
      <div className="actions"><button type="button" className="text-button danger" disabled={busy} onClick={onClose}>CANCEL</button><button className="primary" disabled={!valid || busy}>{busy ? 'Đang lưu…' : post ? 'ACCEPT' : 'SUBMIT'}</button></div>
    </form>
  </dialog>;
}
