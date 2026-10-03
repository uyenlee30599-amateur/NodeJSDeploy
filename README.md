# Lab 23.1 Triển khai ứng dụng NodeJS lên Render

Ứng dụng MessageNode kế thừa Lab22.1–22.2, gồm React, REST API Express, xác thực JWT và Socket.IO. Bài làm cấu hình một Render Web Service phục vụ cả frontend và backend qua cùng URL HTTPS; tài khoản, bài viết và ảnh lưu trong MongoDB Atlas.

## Đối chiếu đề bài

Đề cho phép dùng một ứng dụng đã tạo trước đó và yêu cầu triển khai trên **Render**. Câu cuối nhắc Vercel; bài này thực hiện theo yêu cầu nền tảng Render ở đoạn chính.

- Dùng ứng dụng NodeJS đã làm: kế thừa mạng xã hội Lab22.
- Chuẩn bị triển khai: có `npm start`, `render.yaml`, phiên bản Node, health check `/health`, đọc cổng `PORT` và bind `0.0.0.0`.
- Frontend production dùng chính origin đang truy cập cho API, ảnh và Socket.IO. Tải lại `/login`, `/signup`, `/posts/:id` vẫn nhận trang React.
- Dữ liệu không phụ thuộc ổ đĩa tạm: MongoDB lưu cả ảnh PNG/JPEG/WebP, giới hạn 5 MB; khi thay/xóa bài, ảnh cũ cũng được dọn.
- Đưa ứng dụng online: cần kết nối repository GitHub với tài khoản Render, nhập cấu hình Atlas và chờ service báo Live. **Chưa có URL Render được xác nhận; phần triển khai online chưa hoàn tất.**

## Chạy và kiểm tra trên máy

Yêu cầu Node.js 22.12+ hoặc 24 LTS và MongoDB local/Atlas truy cập được. Render được cấu hình Node 24.21.0.

```bash
cd Lab23.1
npm ci
# Chỉ chạy khi chưa có .env:
cp .env.example .env
```

Trong `.env`, nhập `MONGODB_URI`, giữ `MONGODB_DB=node-lab23`, và đặt `JWT_SECRET` ngẫu nhiên ít nhất 32 ký tự. Có thể tạo secret bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

```bash
npm run check:db
npm run dev
```

React: `http://localhost:3023`; API: `http://localhost:5023`. Cổng riêng giúp không xung đột Lab22. Khi chạy development, `CLIENT_ORIGIN=http://localhost:3023`.

Thử đúng chế độ production:

```bash
npm run build
NODE_ENV=production npm start
```

Mở `http://localhost:5023`. Trong production React, API và socket đều chạy trên cổng của backend.

```bash
npm test
# Khi production server đang chạy, kiểm tra MongoDB thật và hai socket:
npm run test:smoke
```

Smoke test dùng database theo `.env`, tạo tài khoản/bài viết thử và dọn dữ liệu trong `finally`. Chỉ chạy trên database lab. Các test tự động mặc định dùng store trong bộ nhớ, không sửa dữ liệu Atlas.

## Triển khai Render bằng Blueprint

1. Tạo repository GitHub cho bài này và đưa **nội dung bên trong Lab23.1** vào root repository. Root cần có `package.json`, `package-lock.json`, `render.yaml`, `server/` và `client/`. Không upload file ZIP thay cho mã nguồn.
2. Không đưa `.env`, `node_modules`, `client/dist` hoặc ảnh thử lên GitHub. `.gitignore` đã loại trừ những file này. Giữ `.env.example`.
3. Đăng nhập [Render Dashboard](https://dashboard.render.com/), chọn **New → Blueprint**, kết nối repository.
4. Render đọc `render.yaml`: Web Service, Node, Singapore, **Free**, build `npm ci --include=dev && npm run build`, start `npm start`, health check `/health`.
5. Điền `MONGODB_URI` của Atlas khi Blueprint yêu cầu. `MONGODB_DB=node-lab23` được khai báo sẵn; `JWT_SECRET` do Render tạo ngẫu nhiên. Không điền URI vào mã nguồn hoặc README.
6. Trong Atlas, cho phép các outbound IP ranges của Render service qua Network Access. Lấy các dải IP từ phần Connect/Outbound của service; xem [hướng dẫn outbound IP của Render](https://render.com/docs/outbound-ip-addresses). Database user cần quyền đọc/ghi database `node-lab23`.
7. Deploy và chờ service báo **Live**. Mở URL `https://<ten-service>.onrender.com` do Render cấp. Không đặt `CLIENT_ORIGIN=http://localhost:3023` trên Render: backend tự dùng `RENDER_EXTERNAL_URL`. Không đặt `VITE_API_URL` khi frontend/backend dùng cùng service.

## Nếu tạo Web Service thủ công

Kết nối repository, chọn các cấu hình sau:

| Trường | Giá trị |
| --- | --- |
| Runtime | Node |
| Region | Singapore |
| Plan | Free |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| NODE_ENV | `production` |
| NODE_VERSION | `24.21.0` |
| MONGODB_URI | URI Atlas của bạn |
| MONGODB_DB | `node-lab23` |
| JWT_SECRET | Secret ngẫu nhiên ít nhất 32 ký tự |

Root Directory để trống khi nội dung Lab23.1 ở root repository. Nếu dùng repository chứa nhiều lab, đặt Root Directory là `Lab23.1`. Blueprint trong thư mục này được viết cho repository riêng; khi dùng repository nhiều lab, ưu tiên tạo Web Service thủ công với Root Directory đúng.

## Xác nhận kết quả online và nộp bài

1. Mở URL Render bằng cửa sổ ẩn danh hoặc máy khác, xác nhận không còn dùng localhost.
2. Mở `/health`, nhận `{"status":"ok"}`. Health check cũng ping MongoDB.
3. Signup, Login, tạo bài có ảnh, xem chi tiết và tải lại trực tiếp trang chi tiết.
4. Mở hai cửa sổ đã đăng nhập. Tạo, sửa, xóa bài ở cửa sổ A; cửa sổ B tự cập nhật.
5. Tạo một bài có ảnh rồi Restart Service trên Render. Sau khi Live trở lại, bài và ảnh vẫn tải được từ MongoDB.
6. Nộp link GitHub, URL Render, ảnh service báo Live và ảnh ứng dụng đang chạy tại URL online. Che thông tin secret nếu chụp dashboard.

## Trạng thái kiểm chứng

- 9 backend tests và 15 frontend tests đã qua.
- Build React production thành công.
- Smoke test production với MongoDB Atlas thật và hai socket đã qua: create/update/delete, tên người đăng và đọc đúng byte ảnh; dữ liệu thử được dọn.
- Test production kiểm tra React routes, API 404 và ảnh còn truy cập sau khi tạo lại HTTP server với cùng store. Bước Restart Service trên Render phải được kiểm tra sau khi có service online.
- Chưa triển khai/kiểm chứng URL public: cần phiên đăng nhập Render và repository GitHub.

## Lưu ý Render Free

Service Free có thể ngủ sau 15 phút không có traffic; lần truy cập tiếp theo sẽ cần thời gian khởi động. Ổ đĩa local không bền vững, nên bài này lưu ảnh trong MongoDB. Không cần persistent disk trả phí. Với nhiều ảnh lớn, theo dõi dung lượng Atlas; cách lưu này phù hợp phạm vi lab.

Tài liệu: [Deploy Node Express](https://render.com/docs/deploy-node-express-app), [Blueprint reference](https://render.com/docs/blueprint-spec), [Node version](https://render.com/docs/node-version), [Free instances](https://render.com/docs/free).
