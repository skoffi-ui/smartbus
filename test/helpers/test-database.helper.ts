import { DataSource, DataSourceOptions } from 'typeorm';

export const getTestDataSourceOptions = (): DataSourceOptions => {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'smartbus_test',
    synchronize: true,
    dropSchema: true,
    entities: ['libs/database/src/entities/**/*.entity.ts'],
    logging: false,
  };
};

export const createTestDataSource = async (): Promise<DataSource> => {
  const dataSource = new DataSource(getTestDataSourceOptions());
  await dataSource.initialize();
  return dataSource;
};

export const cleanupTestDatabase = async (
  dataSource: DataSource,
): Promise<void> => {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.dropDatabase();
    await dataSource.destroy();
  }
};
