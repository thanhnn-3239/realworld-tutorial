# RealWorld NestJS API

Backend RealWorld sử dụng NestJS, Prisma và PostgreSQL.

## Yêu cầu

- Docker Engine hoặc Docker Desktop có Docker Compose
- GNU Make
- Không cần cài Node.js hoặc pnpm trên host

## Chạy môi trường development

```bash
cp .env.example .env
make dev
```

`make dev` chờ PostgreSQL healthy, cài dependency, chạy migration rồi mới khởi động NestJS ở chế độ watch. Migration lỗi thì app không start.

Các địa chỉ mặc định:

- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/docs`

Các biến của app nằm trong `.env`. Compose chỉ ghi đè `DATABASE_URL` để đổi hostname từ `localhost` sang service `postgres`; nhờ vậy cùng một `.env` dùng được cho cả lệnh chạy trên host và app trong container.

Toàn bộ workspace, bao gồm `node_modules` và pnpm store, được bind mount giữa host và container để IDE trên host đọc dependency. Sau khi dùng `make dev`, không chạy `pnpm` trực tiếp trên host vì metadata store mang đường dẫn `/app`; hãy chạy mọi lệnh pnpm qua các target `make` hoặc `make run-in-workspace`.

## Lệnh thường dùng

| Lệnh                                  | Mục đích                                            |
| ------------------------------------- | --------------------------------------------------- |
| `make dev`                            | Build và chạy development stack                     |
| `make stop`                           | Dừng container nhưng giữ lại container và volume    |
| `make down`                           | Xóa container/network, giữ volume database          |
| `make restart`                        | Khởi động lại app; lifecycle migrate → app chạy lại |
| `make logs`                           | Theo dõi log app                                    |
| `make test`                           | Chạy unit test                                      |
| `make test-e2e`                       | Chạy E2E test với PostgreSQL                        |
| `make lint`                           | Chạy lint gate giống CI                             |
| `make build`                          | Build application trong Docker stage độc lập        |
| `make generate`                       | Generate Prisma Client                              |
| `make migrate`                        | Chạy migration thủ công                             |
| `make seed`                           | Seed database, cần `DEMO_USER_PASSWORD`             |
| `make shell`                          | Mở shell trong app container                        |
| `make run-in-workspace command='...'` | Chạy lệnh bất kỳ trong workspace container          |

Ví dụ:

```bash
make run-in-workspace command='pnpm typecheck'
```

Adminer là tool tùy chọn:

```bash
docker compose --profile tools up -d adminer
```

Mở `http://localhost:8080`, server database là `postgres`.

## Render

Repository có hai Blueprint thay thế cho cùng service/database:

- `render.yaml`: Native Node, là cấu hình mặc định. Build bằng pnpm, migrate trước khi start và seed một lần qua `initialDeployHook`.
- `render-docker.yaml`: Docker production. Entrypoint chạy migration trước NestJS; seed production thực hiện thủ công.

Không tạo hai Blueprint cùng lúc cho hai file này. Muốn chuyển runtime, đổi **Blueprint Path** của Blueprint hiện có, xem Preview rồi mới Manual Sync.

Cả hai cấu hình đều dùng `autoDeployTrigger: off`. Sau khi CI pass và merge vào `main`, deploy bằng **Manual Deploy** trên Render Dashboard. Blueprint Auto Sync cũng cần tắt trên Dashboard.

Các thao tác Manual Sync, Manual Deploy, cấu hình secret và seed production đều là thao tác remote; repository không tự thực hiện.

## CI

GitHub Actions kiểm tra:

- Prisma Client không bị stale
- lint và typecheck
- unit test
- E2E test với PostgreSQL
- application build
- Docker production image và non-root runtime

Không commit `.env`, mật khẩu hoặc connection string thật.
