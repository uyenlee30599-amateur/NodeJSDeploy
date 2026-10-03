import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Feed from './pages/Feed';
import { applyPostEvent } from './realtime';
const mocks = vi.hoisted(() => ({ sockets: [] }));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => {
  const handlers = new Map();
  const socket = { on: vi.fn((name, fn) => handlers.set(name, fn)), off: vi.fn((name, fn) => { if (handlers.get(name) === fn) handlers.delete(name); }), connect: vi.fn(), disconnect: vi.fn(), emitServer: (name, data) => handlers.get(name)?.(data) };
  mocks.sockets.push(socket); return socket;
}) }));
const user = { _id: 'owner', name: 'Owner', status: 'I am new!' };
const session = { user, token: 'token' };
const post = { _id: 'post1', title: 'Original title', content: 'Original content', creator: user, imageUrl: '/images/example.png', createdAt: '2026-10-03T00:00:00Z' };
const response = posts => ({ ok: true, status: 200, json: async () => ({ posts }) });
beforeEach(() => { mocks.sockets.length = 0; vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([post]))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() { return render(<MemoryRouter><Feed session={session} onUserChange={vi.fn()} /></MemoryRouter>); }
function event(name, data) { act(() => mocks.sockets[0].emitServer(name, data)); }
it('Update đổi tiêu đề/tên người đăng ngay; create từ socket và HTTP không tạo bản sao', async () => {
  setup(); await screen.findByRole('heading', { name: 'Original title' });
  event('posts', { action: 'update', post: { ...post, title: 'Updated title', creator: { ...user, name: 'Updated owner' } } });
  expect(screen.queryByRole('heading', { name: 'Original title' })).not.toBeInTheDocument(); expect(screen.getByText(/Updated owner/)).toBeInTheDocument();
  event('posts', { action: 'create', post: { ...post, _id: 'post2', title: 'New post' } });
  event('posts', { action: 'create', post: { ...post, _id: 'post2', title: 'New post' } });
  expect(screen.getAllByRole('heading', { name: 'New post' })).toHaveLength(1);
});
it('Delete từ client khác gọi loadPosts và hiển thị No posts found', async () => {
  setup(); await screen.findByRole('heading', { name: 'Original title' }); fetch.mockResolvedValue(response([]));
  event('posts', { action: 'delete', post: post._id });
  expect(await screen.findByText('No posts found.')).toBeInTheDocument(); expect(fetch).toHaveBeenCalledTimes(2);
});
it('Kết nối lại tải dữ liệu mới và cleanup gỡ listener/đóng socket', async () => {
  const view = setup(); await screen.findByRole('heading', { name: 'Original title' });
  event('disconnect'); expect(screen.getByText(/Mất kết nối realtime/)).toBeInTheDocument();
  fetch.mockResolvedValue(response([{ ...post, title: 'Changed while offline' }])); event('connect');
  expect(await screen.findByRole('heading', { name: 'Changed while offline' })).toBeInTheDocument(); expect(screen.getByText('Đã kết nối realtime')).toBeInTheDocument();
  view.unmount(); expect(mocks.sockets[0].off).toHaveBeenCalledWith('posts', expect.any(Function)); expect(mocks.sockets[0].disconnect).toHaveBeenCalledTimes(1);
});
it('HTTP đang tải không ghi đè update từ socket bằng dữ liệu cũ', async () => {
  let finish; fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; })); setup();
  event('posts', { action: 'update', post: { ...post, title: 'Socket newest title' } });
  await act(async () => finish(response([post])));
  expect(await screen.findByRole('heading', { name: 'Socket newest title' })).toBeInTheDocument();
});
it('Token bị từ chối hoặc hết hạn phát auth-expired', async () => {
  const expired = vi.fn(); window.addEventListener('auth-expired', expired);
  setup(); await screen.findByRole('heading', { name: 'Original title' });
  event('connect_error', { data: { status: 401 } }); event('auth-expired'); expect(expired).toHaveBeenCalledTimes(2);
  window.removeEventListener('auth-expired', expired);
});
it('HTTP lưu New Post và sự kiện create trùng nhau chỉ hiện một bài', async () => {
  setup(); await screen.findByRole('heading', { name: 'Original title' }); fireEvent.click(screen.getByRole('button', { name: 'NEW POST' }));
  fireEvent.change(screen.getByLabelText('TITLE'), { target: { value: 'Created post' } }); fireEvent.change(screen.getByLabelText('CONTENT'), { target: { value: 'New content' } }); fireEvent.change(screen.getByLabelText('IMAGE'), { target: { files: [new File(['png'], 'test.png', { type: 'image/png' })] } });
  const created = { ...post, _id: 'post2', title: 'Created post' };
  fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ post: created }) });
  event('posts', { action: 'create', post: created }); fireEvent.click(screen.getByRole('button', { name: 'SUBMIT' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(screen.getAllByRole('heading', { name: 'Created post' })).toHaveLength(1);
});
it('Update không thêm bài không tồn tại và Delete dùng post ID dạng chuỗi', () => {
  expect(applyPostEvent([post], { action: 'update', post: { ...post, _id: 'unknown' } })).toEqual([post]);
  expect(applyPostEvent([post], { action: 'delete', post: 'post1' })).toEqual([]);
});
