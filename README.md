# NestJS gRPC 示例（Monorepo）

本仓库演示如何使用 NestJS 构建基于 gRPC 的微服务，包含两个子应用：

- `app/main`：gRPC 服务端（微服务）
- `app/client`：HTTP 网关客户端，通过 Nest 的 `ClientGrpc` 调用 gRPC 服务

并通过 `pnpm` 工作区统一管理依赖与脚本。

---

## 目录结构

```text
nestjs-grpc/
├─ app/
│  ├─ main/                 # gRPC 服务端
│  │  ├─ src/
│  │  │  ├─ app.controller.ts    # 通过 @GrpcMethod 实现服务
│  │  │  ├─ app.module.ts
│  │  │  └─ main.ts               # 创建 gRPC 微服务
│  │  ├─ proto/hero.proto         # 服务端使用的 proto
│  │  ├─ nest-cli.json            # 复制 .proto 到 dist 的 assets 设置
│  │  └─ package.json
│  └─ client/               # HTTP 客户端（调用 gRPC）
│     ├─ src/
│     │  ├─ app.controller.ts     # 通过 ClientGrpc 调用服务，并暴露 GET /
│     │  ├─ app.module.ts         # 注册 gRPC 客户端（ClientsModule.register）
│     │  └─ main.ts               # 启动 HTTP 服务器（端口 3001）
│     ├─ proto/hero.proto         # 客户端使用的 proto（与服务端一致）
│     ├─ nest-cli.json            # 复制 .proto 到 dist 的 assets 设置
│     └─ package.json
├─ docs/
│  └─ 书写.proto文件的规范.md      # 项目内的 .proto 书写规范参考
├─ package.json                   # 工作区根脚本（统一启动/构建）
└─ pnpm-workspace.yaml
```

---

## 运行环境要求

- Node.js：建议使用当前 LTS（≥ 18）
- pnpm：建议 ≥ 8
- NestJS CLI（可选）：`npm i -g @nestjs/cli`

---

## 安装与启动

### 1) 安装依赖

在项目根目录执行：

```bash
pnpm install
```

### 2) 一键并行启动（推荐）

在项目根目录执行：

```bash
pnpm dev
```

该命令等价于同时在 `app-main` 与 `app-client` 下运行 `start:dev`。

### 3) 分应用启动（可选）

- 启动 gRPC 服务端（微服务）

```bash
pnpm run start:main
```

- 启动 HTTP 客户端（端口 3001，转调 gRPC）

```bash
pnpm run start:client
```

> 也可以分别进入子目录运行：
>
> - `cd app/main && pnpm start:dev`
> - `cd app/client && pnpm start:dev`

---

## gRPC 与 HTTP 行为速览

- HTTP 客户端监听：`http://localhost:3001/`
- 访问 `GET /` 时，客户端会通过 gRPC 调用服务端 `HeroService/FindOne`，请求 `id=2`，并返回查到的英雄对象（示例数据位于服务端）。

快速验证：

```bash
curl -i http://localhost:3001/
```

期望响应（示例）：

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
...

{"id":2,"name":"Doe"}
```

---

## Proto 定义

两端共用同一份语义一致的 `.proto`（各自仓内各有一份，内容一致，便于独立构建与发布）：

```proto
// hero/hero.proto
syntax = "proto3";

package hero;

service HeroService {
  rpc FindOne (HeroById) returns (Hero) {}
}

message HeroById {
  int32 id = 1;
}

message Hero {
  int32 id = 1;
  string name = 2;
}
```

> 更多 proto 书写规范与最佳实践，见 `docs/书写.proto文件的规范.md`。

---

## 服务端（app/main）关键实现

- 控制器：使用 `@GrpcMethod('HeroService', 'FindOne')` 实现查询逻辑，基于内存示例数据返回 `Hero`。

```ts
// app/main/src/app.controller.ts
import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'

@Controller()
export class AppController {
  @GrpcMethod('HeroService', 'FindOne')
  getHello(data: any) {
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Doe' },
    ]
    return items.find(({ id }) => id === data.id)
  }
}
```

- 启动 gRPC 微服务：

```ts
// app/main/src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Transport, MicroserviceOptions } from '@nestjs/microservices'
import path from 'path'

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'hero',
      protoPath: path.join(__dirname, '../proto/hero.proto'),
      // 未显式设置 url，建议按“显式设置 url 的建议”章节配置
    },
  })
  await app.listen()
}
bootstrap()
```

> 说明：`app/main/nest-cli.json` 的 `assets: ["**/*.proto"]` 会在构建/监听时将 `.proto` 复制到 `dist`，因此运行时 `protoPath` 指向 `dist` 内的相对路径能正常工作。

---

## 客户端（app/client）关键实现

- 注册 gRPC 客户端并暴露 HTTP：

```ts
// app/client/src/app.module.ts
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ClientsModule, Transport } from '@nestjs/microservices'
import path from 'path'

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'HERO_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'hero',
          protoPath: path.join(__dirname, '../proto/hero.proto'),
          // 未显式设置 url，建议按“显式设置 url 的建议”章节配置
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- 通过 HTTP 路由触发 gRPC：

```ts
// app/client/src/app.controller.ts
import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common'
import { ClientGrpc } from '@nestjs/microservices'

interface Hero {
  id: number
  name: string
}
interface HeroById {
  id: number
}
interface HeroesService {
  findOne(data: HeroById): Promise<Hero>
}

@Controller()
export class AppController implements OnModuleInit {
  private heroService: HeroesService
  constructor(@Inject('HERO_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.heroService = this.client.getService<HeroesService>('HeroService')
  }

  @Get()
  getHello(): Promise<Hero> {
    return this.heroService.findOne({ id: 2 })
  }
}
```

- 启动 HTTP 服务器：

```ts
// app/client/src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(3001)
}
bootstrap()
```

---

## 显式设置 gRPC url 的建议（强烈推荐）

当前项目未在 server/client 的 gRPC 配置中显式设置 `options.url`。为避免环境差异导致连接失败，建议显式设置，确保两端一致：

- 服务端 `app/main/src/main.ts`：

```ts
options: {
  package: 'hero',
  protoPath: path.join(__dirname, '../proto/hero.proto'),
  url: '0.0.0.0:50051',
},
```

- 客户端 `app/client/src/app.module.ts`：

```ts
options: {
  package: 'hero',
  protoPath: path.join(__dirname, '../proto/hero.proto'),
  url: 'localhost:50051',
},
```

> 一般建议服务端监听 `0.0.0.0:PORT`，客户端连接 `localhost:PORT`（或指定主机名/IP）。

---

## 常见问题（FAQ）

- Proto 路径问题：

  - 确保 `protoPath` 指向构建产物中的相对路径（本项目已通过 `nest-cli.json` 的 `assets` 自动复制）。
  - 若你调整了目录结构或构建方式，请同步更新 `protoPath`。

- gRPC 连接失败：

  - 确保服务端与客户端使用相同的 `url`（推荐显式设置）。
  - 确保端口未被占用，必要时更换端口（如 50051/50052）。

- 依赖安装/Node 版本问题：
  - 使用 LTS Node，清理并重新安装：`rm -rf node_modules pnpm-lock.yaml && pnpm install`。

---

## 开发脚本与构建

- 根目录脚本（见根 `package.json`）：

  - `pnpm dev`：并行启动两个应用的 `start:dev`
  - `pnpm start:main`：仅启动服务端（开发模式）
  - `pnpm start:client`：仅启动客户端（开发模式）
  - `pnpm build`：并行构建两个子应用

- 子应用脚本（见各自 `package.json`）：
  - `pnpm start` / `pnpm start:dev` / `pnpm start:prod`
  - `pnpm test` / `pnpm test:e2e` / `pnpm test:cov`

---

## 扩展建议

- 多服务与多 proto：将不同领域的服务拆分为独立的 proto 与微服务。
- 接口类型生成：可引入 `ts-proto`（客户端已安装 dev 依赖）将 `.proto` 生成为 TS 类型，减少手写接口定义。
- 配置集中化：将 gRPC `url` 等参数提取到环境变量或配置中心（如 `@nestjs/config`）。

---

## 参考

- NestJS 微服务（gRPC）官方文档（请以所用 Nest 版本为准）
- 本仓库：`docs/书写.proto文件的规范.md`

---

## License

本项目用于学习与演示，可自由拓展与复用。
