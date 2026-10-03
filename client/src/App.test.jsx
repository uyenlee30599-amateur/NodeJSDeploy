import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import PostForm from './components/PostForm';
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() })) }));
const user = { _id: '123456789012345678901234', name: 'Test User', email: 'test@example.com', status: 'I am new!' };
const post = { _id: 'abcdefabcdefabcdefabcdef', title: 'First post', content: 'Original content', imageUrl: '/images/example.png', creator: user, createdAt: '2026-10-03T00:00:00Z' };
function response(data, status = 200) { return { ok: status < 400, status, json: async () => data }; }
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const renderApp = (path = '/') => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
function signIn() { localStorage.setItem('lab23.auth', JSON.stringify({ token: 'token', user })); }
it('Chưa đăng nhập chuyển về Login; validate trước khi gọi API', () => {
  renderApp(); fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
  expect(screen.getByText('E-mail không hợp lệ.')).toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
});
it('Signup thành công chuyển sang Login với thông báo', async () => {
  fetch.mockResolvedValue(response({ user }, 201)); renderApp('/signup');
  fireEvent.change(screen.getByLabelText('YOUR E-MAIL'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('YOUR NAME'), { target: { value: 'Test User' } });
  fireEvent.change(screen.getByLabelText('PASSWORD'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'SIGNUP' }));
  expect(await screen.findByText('Đăng ký thành công. Hãy đăng nhập.')).toBeInTheDocument();
  expect(fetch.mock.calls[0][1].method).toBe('PUT');
});
it('Login lưu token, hiển thị feed rỗng và Logout xóa phiên', async () => {
  fetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/auth/login') ? { token: 'token', user } : url.endsWith('/auth/me') ? { user } : { posts: [] })));
  renderApp('/login'); fireEvent.change(screen.getByLabelText('YOUR E-MAIL'), { target: { value: 'test@example.com' } }); fireEvent.change(screen.getByLabelText('PASSWORD'), { target: { value: 'password123' } }); fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
  expect(await screen.findByText('No posts found.')).toBeInTheDocument(); expect(JSON.parse(localStorage.getItem('lab23.auth')).token).toBe('token');
  fireEvent.click(screen.getByRole('button', { name: 'Logout' })); expect(localStorage.getItem('lab23.auth')).toBeNull(); expect(screen.getByRole('button', { name: 'LOGIN' })).toBeInTheDocument();
});
it('New Post chỉ bật Submit khi đủ dữ liệu, gửi multipart và đóng form khi thành công', async () => {
  signIn(); fetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/auth/me') ? { user } : url.endsWith('/feed/post') ? { post } : { posts: [] })));
  renderApp(); await screen.findByText('No posts found.'); fireEvent.click(screen.getByRole('button', { name: 'NEW POST' }));
  const submit = screen.getByRole('button', { name: 'SUBMIT' }); expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('TITLE'), { target: { value: 'First post' } }); fireEvent.change(screen.getByLabelText('CONTENT'), { target: { value: 'Original content' } }); expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('IMAGE'), { target: { files: [new File(['png'], 'test.png', { type: 'image/png' })] } }); expect(submit).toBeEnabled(); fireEvent.click(submit);
  expect(await screen.findByRole('heading', { name: 'First post' })).toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const call = fetch.mock.calls.find(([url]) => url.endsWith('/feed/post')); expect(call[1].body).toBeInstanceOf(FormData); expect(call[1].headers.Authorization).toBe('Bearer token');
});
it('Edit điền sẵn giá trị, không bắt chọn lại ảnh và giữ form khi API lỗi', async () => {
  fetch.mockResolvedValue(response({ message: 'Lỗi dữ liệu' }, 422));
  const saved = vi.fn(); render(<PostForm post={post} token="token" onClose={vi.fn()} onSaved={saved} />);
  expect(screen.getByLabelText('TITLE')).toHaveValue('First post'); expect(screen.getByLabelText('CONTENT')).toHaveValue('Original content');
  fireEvent.click(screen.getByRole('button', { name: 'ACCEPT' })); expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi dữ liệu'); expect(saved).not.toHaveBeenCalled();
});
it('View hiển thị chi tiết bài và ảnh', async () => {
  signIn(); fetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/auth/me') ? { user } : { post })));
  renderApp(`/posts/${post._id}`); expect(await screen.findByText('Original content')).toBeInTheDocument(); expect(screen.getByRole('img')).toHaveAttribute('src', 'http://localhost:5023/images/example.png');
});
it('Delete thành công cập nhật danh sách', async () => {
  signIn(); vi.stubGlobal('confirm', vi.fn(() => true));
  let posts = [post];
  fetch.mockImplementation((url, options) => {
    if (options.method === 'DELETE') { posts = []; return Promise.resolve(response({ message: 'Đã xóa bài viết.' })); }
    return Promise.resolve(response(url.endsWith('/auth/me') ? { user } : { posts }));
  });
  renderApp(); await screen.findByRole('heading', { name: 'First post' }); fireEvent.click(screen.getByRole('button', { name: 'DELETE' })); expect(await screen.findByText('No posts found.')).toBeInTheDocument();
});
it('Ẩn Edit/Delete của người khác và token hết hạn chuyển về Login', async () => {
  signIn(); fetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/auth/me') ? { user } : { posts: [{ ...post, creator: { ...user, _id: 'another-user' } }] })));
  renderApp(); await screen.findByRole('heading', { name: 'First post' }); expect(screen.queryByRole('button', { name: 'EDIT' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'DELETE' })).not.toBeInTheDocument();
  window.dispatchEvent(new Event('auth-expired')); await waitFor(() => expect(screen.getByRole('button', { name: 'LOGIN' })).toBeInTheDocument()); expect(localStorage.getItem('lab23.auth')).toBeNull();
});
