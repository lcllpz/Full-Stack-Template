import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { CaptchaModule } from '@/captcha/captcha.module';
import { QueueModule } from '@/queue/queue.module';
import { SessionModule } from '@/session/session.module';
import { UserModule } from '@/user/user.module';
import { VerificationModule } from '@/verification/verification.module';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UserModule,
    SessionModule,
    JwtModule.register({}),
    PassportModule,
    CaptchaModule,
    VerificationModule,
    QueueModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshAuthGuard,
  ],
  exports: [JwtAuthGuard, JwtRefreshAuthGuard],
})
export class AuthModule {}
