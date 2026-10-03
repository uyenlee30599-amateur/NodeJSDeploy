import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './api';
export function applyPostEvent(posts, event) {
  if (event.action === 'delete') return posts.filter(post => String(post._id) !== String(event.post));
  const post = event.post;
  if (!post?._id) return posts;
  const index = posts.findIndex(item => String(item._id) === String(post._id));
  if (event.action === 'create') return index < 0 ? [post, ...posts] : posts.map(item => String(item._id) === String(post._id) ? post : item);
  if (event.action === 'update') return index < 0 ? posts : posts.map(item => String(item._id) === String(post._id) ? post : item);
  return posts;
}
export function usePostEvents(token, { onPosts, onConnect }) {
  const handlers = useRef({ onPosts, onConnect });
  const [connection, setConnection] = useState('connecting');
  useEffect(() => { handlers.current = { onPosts, onConnect }; }, [onPosts, onConnect]);
  useEffect(() => {
    const socket = io(API_URL, { auth: { token }, autoConnect: false });
    const connected = () => { setConnection('connected'); handlers.current.onConnect?.(); };
    const posts = event => handlers.current.onPosts?.(event);
    const expired = () => window.dispatchEvent(new Event('auth-expired'));
    const disconnected = () => setConnection('disconnected');
    const failed = error => { setConnection('disconnected'); if (error.data?.status === 401) expired(); };
    socket.on('connect', connected);
    socket.on('posts', posts);
    socket.on('disconnect', disconnected);
    socket.on('connect_error', failed);
    socket.on('auth-expired', expired);
    socket.connect();
    return () => {
      socket.off('connect', connected); socket.off('posts', posts); socket.off('disconnect', disconnected);
      socket.off('connect_error', failed); socket.off('auth-expired', expired); socket.disconnect();
    };
  }, [token]);
  return connection;
}
