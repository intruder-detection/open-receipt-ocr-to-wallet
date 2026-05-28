import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from '@core/database/database.module';
import { SecretsModule } from '@core/secrets/secrets.module';
import { StorageModule } from '@core/storage/storage.module';
import { OcrJobsModule } from '@app/ocr-jobs/ocr-jobs.module';
import { WalletModule } from '@app/wallet/wallet.module';
import { SecretProvider } from '@core/secrets/secret-provider.interface';
import { AppSecret } from '@core/types/app-secret.enum';
import { LoggingInterceptor } from '@core/interceptors/logging.interceptor';

type NestModuleImport = Type | DynamicModule | Promise<DynamicModule> | ForwardReference;

const moduleImports: NestModuleImport[] = [
  SecretsModule,
  DatabaseModule,
  StorageModule,
  BullModule.forRootAsync({
    imports: [SecretsModule],
    inject: [SecretProvider],
    useFactory: async (secretProvider: SecretProvider) => ({
      connection: {
        host: await secretProvider.getSecretOrThrow(AppSecret.RedisHost),
        port: await secretProvider.getSecretAsIntOrThrow(AppSecret.RedisPort),
      },
    }),
  }),
  OcrJobsModule,
  WalletModule,
];

if (process.env[AppSecret.NodeEnv] === 'production') {
  moduleImports.push(
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: ['/api', '/api/:a', '/api/:a/:b', '/api/:a/:b/:c', '/api/:a/:b/:c/:d'],
    }),
  );
}

@Module({
  imports: moduleImports,
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
