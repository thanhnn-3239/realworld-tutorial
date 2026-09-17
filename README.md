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
- Mailpit UI: `http://localhost:8025`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`

Các biến của app nằm trong `.env`. Compose chỉ ghi đè `DATABASE_URL` để đổi hostname từ `localhost` sang service `postgres`; nhờ vậy cùng một `.env` dùng được cho cả lệnh chạy trên host và app trong container.

Toàn bộ workspace, bao gồm `node_modules` và pnpm store, được bind mount giữa host và container để IDE trên host đọc dependency. Sau khi dùng `make dev`, không chạy `pnpm` trực tiếp trên host vì metadata store mang đường dẫn `/app`; hãy chạy mọi lệnh pnpm qua các target `make` hoặc `make run-in-workspace`.

## Background jobs & Email delivery

Hệ thống sử dụng BullMQ và Redis để xử lý tác vụ nền (gửi email xác nhận liên kết tài khoản Google).
Ở môi trường local development và E2E testing:

- Redis chạy qua Docker service `redis` (cổng 6379, cấu hình qua `REDIS_URL`).
- Email được gửi qua Mailpit SMTP server (cổng 1025) và có thể xem trực tiếp qua web UI tại `http://localhost:8025` (cấu hình qua `MAILPIT_UI_PORT`).
- Production yêu cầu dịch vụ Redis và SMTP provider được quản lý (managed services); các biến cấu hình gồm `REDIS_URL`, `REDIS_PREFIX`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `MAIL_FROM`, `GOOGLE_LINK_CONFIRM_URL`.

## Apache Kafka & Article Notifications

Hệ thống sử dụng Apache Kafka để triển khai kiến trúc Event-Driven cho các sự kiện bài viết (article notification):
- Khi bài viết mới được tạo (`POST /api/articles`), sự kiện `article.created` được gửi lên Kafka topic `article-events`. Consumer nhận event và đưa email thông báo cho tất cả người theo dõi (followers) của tác giả vào BullMQ email queue.
- Khi người dùng thích bài viết (`POST /api/articles/:slug/favorite`), sự kiện `article.favorited` được gửi lên Kafka topic `article-events`. Consumer nhận event và đưa email thông báo cho tác giả bài viết vào BullMQ email queue (bỏ qua nếu tác giả tự thích bài viết của mình).

### Khởi động Kafka ở môi trường Local

Khi chạy `make dev`, container Kafka (chạy chế độ KRaft, không cần Zookeeper) tự động được khởi động cùng stack.

Nếu muốn khởi động hoặc kiểm tra riêng dịch vụ Kafka:

```bash
docker compose up -d kafka
```

Để theo dõi các sự kiện được publish lên topic `article-events` qua console consumer:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic article-events --from-beginning
```

Hoặc nếu chạy trực tiếp trên môi trường có sẵn Kafka CLI:

```bash
/opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic article-events --from-beginning
```

### Kết nối Aiven Kafka Cloud (Free Tier) với SSL/SASL

Hệ thống hỗ trợ kết nối trực tiếp đến Apache Kafka đám mây (như gói Free Tier của Aiven) thông qua giao thức bảo mật SSL và cơ chế xác thực SASL/PLAIN.

Cấu hình các biến môi trường trong file `.env`:

```env
# Kafka Configuration (Aiven Cloud)
KAFKA_BROKER=kafka-<service-name>-<project-name>.aivencloud.com:12345
KAFKA_CLIENT_ID=realworld-api
KAFKA_GROUP_ID=realworld-notification-group
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_USERNAME=avnadmin
KAFKA_PASSWORD=<mật-khẩu-từ-aiven-console>
ENABLE_KAFKA=true
```

- `KAFKA_SSL=true`: Kích hoạt mã hóa kết nối TLS/SSL tới cloud broker.
- `KAFKA_SASL_MECHANISM=plain`: Cơ chế chứng thực SASL (hỗ trợ `plain`, `scram-sha-256`, `scram-sha-512`).
- `KAFKA_USERNAME` & `KAFKA_PASSWORD`: Thông tin tài khoản quản trị viên được cung cấp trong Aiven Web Console.
- `ENABLE_KAFKA=false`: Tùy chọn tắt microservice Kafka khi không có nhu cầu sử dụng.

## Storage driver

File được lưu trên object storage tương thích S3 (MinIO ở local, AWS S3 ở production), cấu hình qua `STORAGE_BUCKET`, `STORAGE_PUBLIC_URL`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` trong `.env`. `FileStorageService` gọi vào storage qua interface `StorageDriver`, hiện chỉ có một implementation (`S3StorageDriver`) — interface vẫn giữ lại làm chỗ nối để thêm backend khác sau này mà không phải sửa code gọi nó.

Key ảnh đại diện (avatar) có dạng `avatars/{userId}/{uuid}.webp` — không nằm dưới tiền tố `public/`. `docker/minio-init.sh` chỉ mở public-read cho tiền tố `public` trong bucket, không mở cho cả bucket; vì avatar không nằm dưới tiền tố đó, chính sách này hiện **không** cấp quyền đọc ẩn danh cho object avatar dù `FileStorageService.publicUrl` vẫn trả về URL. Đây là điểm chưa khớp giữa key layout và bucket policy, có từ trước, nằm ngoài phạm vi thay đổi hiện tại — không phải đã được xử lý.

## Lệnh thường dùng

| Lệnh                                  | Mục đích                                             |
| ------------------------------------- | ---------------------------------------------------- |
| `make dev`                            | Build và chạy development stack                      |
| `make stop`                           | Dừng container nhưng giữ lại container và volume     |
| `make down`                           | Xóa container/network, giữ volume database           |
| `make restart`                        | Khởi động lại app; lifecycle migrate → app chạy lại  |
| `make logs`                           | Theo dõi log app                                     |
| `make test`                           | Chạy unit test                                       |
| `make test-e2e`                       | Chạy E2E với PostgreSQL, MinIO, Redis, Mailpit riêng |
| `make stop-e2e`                       | Dừng PostgreSQL, MinIO, Redis, Mailpit E2E           |
| `make down-e2e`                       | Xóa container/network E2E, giữ volume                |
| `make clean-e2e`                      | Xóa toàn bộ project E2E, gồm cả volume               |
| `make run-in-e2e command='...'`       | Chạy lệnh trong app container với `.env.e2e`         |
| `make lint`                           | Chạy lint gate giống CI                              |
| `make build`                          | Build application trong Docker stage độc lập         |
| `make generate`                       | Generate Prisma Client                               |
| `make migrate`                        | Chạy migration thủ công                              |
| `make seed`                           | Seed database, cần `DEMO_USER_PASSWORD`              |
| `make shell`                          | Mở shell trong app container                         |
| `make run-in-workspace command='...'` | Chạy lệnh bất kỳ trong workspace container           |

Ví dụ:

```bash
make run-in-workspace command='pnpm typecheck'
```

## Viết và chạy E2E test

Local và CI đều chạy bằng `make test-e2e`. Lệnh này dùng project Compose
`realworld-e2e`, tự tạo `.env.e2e` đã được ignore từ `.env.e2e.example`, rồi khởi động PostgreSQL,
MinIO, Redis và Mailpit thật rồi chạy Jest trong one-off `app` container. Local giữ các service lại
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
