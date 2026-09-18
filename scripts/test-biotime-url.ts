import { NestFactory } from '@nestjs/core';
import { AppModule as SuperAppModule } from '../apps/super-app/src/super-app.module';
import { BiotimeService } from '../apps/super-app/src/modules/biotime/biotime.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SuperAppModule);
  const biotimeService = app.get(BiotimeService);
  const httpService = app.get(HttpService);
  
  try {
    const token = await biotimeService.getAuthToken();
    const url = 'http://160.120.143.20:8080/iclock/api/transactions/?page_size=5';
    console.log('Testing URL:', url);
    
    const response = await firstValueFrom(
      httpService.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \JWT \\
        }
      })
    );
    console.log('Success!', response.data);
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data);
  } finally {
    await app.close();
  }
}
bootstrap();
