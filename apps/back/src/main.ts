import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';

import { setupSwagger } from '@/swagger/setup-swagger';
import validationOptions from '@/utils/validate/validation-options';

import { appConfigKey } from './config/app/config';
import { AllConfigType } from './config/config.type';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AllConfigType>);

  const { port } = configService.getOrThrow(appConfigKey, { infer: true });

  // dto入参校验
  app.useGlobalPipes(new ValidationPipe(validationOptions));

  // 响应体序列化：
  // 作用： 响应返回客户端前，按 class-transformer 装饰器序列化对象，控制哪些字段能出去。
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  setupSwagger(app, configService);

  await app.listen(port);
}

void bootstrap();
