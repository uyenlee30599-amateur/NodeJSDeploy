import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { imageUrl, request } from '../api';
export default function PostDetail({ session }) {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setPost(null); setError('');
    request(`/feed/posts/${id}`, { token: session.token, signal: controller.signal }).then(data => setPost(data.post)).catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [id, session.token]);
  return <article className="detail"><Link className="text-button" to="/">← BACK TO FEED</Link>{error ? <p className="error" role="alert">{error}</p> : !post ? <p>Đang tải bài viết…</p> : <><h1>{post.title}</h1><p className="metadata">Created by {post.creator.name} on {new Date(post.createdAt).toLocaleDateString('vi-VN')}</p><hr /><img src={imageUrl(post.imageUrl)} alt={post.title} /><p className="content">{post.content}</p></>}</article>;
}
