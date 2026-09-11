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

## Storage driver

File được lưu trên object storage tương thích S3 (MinIO ở local, AWS S3 ở production), cấu hình qua `STORAGE_BUCKET`, `STORAGE_PUBLIC_URL`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` trong `.env`. `FileStorageService` gọi vào storage qua interface `StorageDriver`, hiện chỉ có một implementation (`S3StorageDriver`) — interface vẫn giữ lại làm chỗ nối để thêm backend khác sau này mà không phải sửa code gọi nó.

Key sinh ra luôn có tiền tố `public/uploads/...` — chuẩn bị chỗ cho một tiền tố `private/` sau này mà không phải di chuyển object đã có. `docker/minio-init.sh` chỉ mở public-read cho tiền tố `public` trong bucket, không mở cho cả bucket, để tiền tố `private/` sau này mặc định không đọc được.

## Lệnh thường dùng

| Lệnh                                  | Mục đích                                            |
| ------------------------------------- | --------------------------------------------------- |
| `make dev`                            | Build và chạy development stack                     |
| `make stop`                           | Dừng container nhưng giữ lại container và volume    |
| `make down`                           | Xóa container/network, giữ volume database          |
| `make restart`                        | Khởi động lại app; lifecycle migrate → app chạy lại |
| `make logs`                           | Theo dõi log app                                    |
| `make test`                           | Chạy unit test                                      |
| `make test-e2e`                       | Chạy E2E với PostgreSQL + MinIO riêng               |
| `make stop-e2e`                       | Dừng PostgreSQL + MinIO E2E, giữ container/volume   |
| `make down-e2e`                       | Xóa container/network E2E, giữ volume               |
| `make clean-e2e`                      | Xóa toàn bộ project E2E, gồm cả volume              |
| `make run-in-e2e command='...'`       | Chạy lệnh trong app container với `.env.e2e`        |
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

## Viết và chạy E2E test

Local và CI đều chạy bằng `make test-e2e`. Lệnh này dùng project Compose
`realworld-e2e`, tự tạo `.env.e2e` đã được ignore từ `.env.e2e.example`, rồi khởi động PostgreSQL và
MinIO thật rồi chạy Jest trong one-off `app` container. Local giữ hai service lại
để lần chạy sau nhanh hơn; CI luôn gọi `make clean-e2e` ở bước `always()`.

Mỗi file test có database và bucket riêng. Harness migrate template một lần cho
cả run, clone database cho từng suite, rồi reset toàn bộ bảng ứng dụng và bucket
trước mỗi test. Các suite chạy song song với nhau; không dùng `test.concurrent`
bên trong một file.

Test mới bắt đầu bằng context mỏng:

```ts
describe('Articles (e2e)', () => {
  const e2e = useE2eSuite('articles');

  it('creates an article', async () => {
    const author = await e2e.fixtures.authenticatedUser();
    await e2e.request
      .post('/v1/articles')
      .set('Authorization', author.authorization)
      .send({ title: 'Hello', description: 'Intro', body: 'Body' })
      .expect(201);
  });
});
```

Dùng fixture Prisma cho prerequisite và HTTP cho hành vi đang kiểm thử. Suite
repository dùng `useDatabaseSuite`. Muốn chạy một file:

```bash
make test-e2e E2E_TEST_ARGS='--runInBand test/articles-crud-lifecycle.e2e-spec.ts'
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
- E2E test với PostgreSQL + MinIO qua cùng `.env.e2e` được tạo từ template và Compose flow như local
- application build
- Docker production image và non-root runtime

Không commit `.env`, mật khẩu hoặc connection string thật.
