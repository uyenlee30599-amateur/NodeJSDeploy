import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../api';
import { applyPostEvent, usePostEvents } from '../realtime';
export default function usePosts(token) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef(null);
  const loadPosts = useCallback(async () => {
    active.current?.controller.abort();
    const run = { controller: new AbortController(), events: [] };
    active.current = run; setLoading(true); setError('');
    try {
      const data = await request('/feed/posts', { token, signal: run.controller.signal });
      // Replay các sự kiện đến trong lúc GET đang chờ, tránh HTTP cũ ghi đè dữ liệu realtime.
      if (active.current === run && !run.controller.signal.aborted) setPosts(run.events.reduce(applyPostEvent, data.posts));
    } catch (failure) { if (failure.name !== 'AbortError' && active.current === run && !run.controller.signal.aborted) setError(failure.message); }
    finally { if (active.current === run && !run.controller.signal.aborted) { active.current = null; setLoading(false); } }
  }, [token]);
  const handlePost = useCallback(event => {
    active.current?.events.push(event);
    setPosts(old => applyPostEvent(old, event));
    if (event.action === 'delete') loadPosts();
  }, [loadPosts]);
  const connection = usePostEvents(token, { onPosts: handlePost, onConnect: loadPosts });
  useEffect(() => { loadPosts(); return () => { active.current?.controller.abort(); active.current = null; }; }, [loadPosts]);
  const savePost = useCallback((post, editing) => handlePost({ action: editing ? 'update' : 'create', post }), [handlePost]);
  return { posts, loading, loadError: error, loadPosts, savePost, connection };
}
