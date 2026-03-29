import { Station } from '../../types/radio';

export interface IStationRepository {
  getAll(options?: { limit?: number; offset?: number }): Promise<Station[]>;
  getById(id: string): Promise<Station | undefined>;
  getByCountry(countryCode: string, options?: { limit?: number; offset?: number }): Promise<Station[]>;
  search(query: string, options?: { limit?: number; offset?: number }): Promise<Station[]>;
  getTop(options?: { limit?: number; offset?: number }): Promise<Station[]>;
  upsert(station: Station): Promise<void>;
  upsertMany(stations: Station[]): Promise<void>;
  insertMany(stations: Station[]): Promise<void>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
