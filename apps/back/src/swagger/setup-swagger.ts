import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { appConfigKey } from '@/config/app/config';
import { AllConfigType } from '@/config/config.type';

import { SWAGGER_BEARER_AUTH, SWAGGER_REFRESH_AUTH } from './swagger.constants';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService<AllConfigType>,
): void {
  const { swaggerEnabled, swaggerPath, port } = configService.getOrThrow(appConfigKey, {
    infer: true,
  });

  if (!swaggerEnabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Full-Stack Template API')
    .setDescription('RBAC 管理后台 REST API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '登录接口返回的 access token',
      },
      SWAGGER_BEARER_AUTH,
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '登录接口返回的 refresh token（仅 /auth/refresh）',
      },
      SWAGGER_REFRESH_AUTH,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // 默认所有接口需要 access token；@Public 路由用 @ApiOperation({ security: [] }) 覆盖
  document.security = [{ [SWAGGER_BEARER_AUTH]: [] }];
  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const logger = new Logger('Swagger');
  logger.log(`文档地址: http://localhost:${port}/${swaggerPath}`);
}
