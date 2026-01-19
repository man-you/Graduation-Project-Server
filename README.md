## 知链服务端

## 安装

```bash
$ npm install
```

## 配置

### 数据库配置

```env
# 数据库连接字符串
DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name"

# JWT 密钥配置
JWT_SECRET="your_jwt_secret_key_here"
JWT_REFRESH_SECRET="your_refresh_token_secret_key_here"
```

## 运行

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## 项目文件结构

```
├── src/
│   ├── app.controller.ts          # 主控制器
│   ├── app.module.ts              # 主模块
│   ├── app.service.ts             # 主服务
│   ├── main.ts                    # 应用入口
│   ├── auth/                      # 认证模块
│   │   ├── auth.controller.ts     # 认证控制器
│   │   ├── auth.guard.ts          # 认证守卫
│   │   ├── auth.module.ts         # 认证模块定义
│   │   ├── auth.service.ts        # 认证服务逻辑
│   │   └── dto/                   # 数据传输对象
│   │       └── auth.dto.ts        # 登录/注册数据模型
│   ├── user/                      # 用户模块
│   │   ├── user.controller.ts     # 用户控制器
│   │   ├── user.module.ts         # 用户模块定义
│   │   ├── user.service.ts        # 用户服务逻辑
│   │   └── dto/                   # 用户数据传输对象
│   │       ├── create-user.dto.ts # 创建用户数据模型
│   │       └── update-user.dto.ts # 更新用户数据模型
│   └── skip-auth/                 # 跳过认证装饰器
│       └── skip-auth.decorator.ts # Public 装饰器定义
├── prisma/                        # Prisma 配置目录
│   ├── prisma.module.ts           # Prisma 模块定义
│   └── prisma.service.ts          # Prisma 服务定义
└── README.md                      # 项目说明文档
```

## 测试

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Prisma

```bash
# 初始化数据库并应用迁移
npx prisma migrate dev

# 查看数据库状态
npx prisma db pull

# 生成 Prisma Client
npx prisma generate
```

## swagger文档地址

```
http://localhost:3000/api/v1/docs
```
