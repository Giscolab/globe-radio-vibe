// Engine - Station Repository (in-memory implementation)
import { Station } from '../../types/radio';
import { logger } from '../../core/logger';

export interface IStationRepository {
  getAll(): Station[];
  getById(id: string): Station | undefined;
  getByCountry(countryCode: string): Station[];
  search(query: string): Station[];
  upsert(station: Station): void;
  upsertMany(stations: Station[]): void;
  insertMany(stations: Station[]): void;
  delete(id: string): boolean;
  clear(): void;
  count(): number;
}

class InMemoryStationRepository implements IStationRepository {
  private stations: Map<string, Station> = new Map();
  private countryIndex: Map<string, Set<string>> = new Map();

  getAll(): Station[] {
    return Array.from(this.stations.values());
  }

  getById(id: string): Station | undefined {
    return this.stations.get(id);
  }

  getByCountry(countryCode: string): Station[] {
    const code = countryCode.toUpperCase();
    const ids = this.countryIndex.get(code);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.stations.get(id))
      .filter((s): s is Station => s !== undefined);
  }

  search(query: string): Station[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.stations.values()).filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.country.toLowerCase().includes(lowerQuery) ||
      s.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  upsert(station: Station): void {
    // Remove from old country index if exists
    const existing = this.stations.get(station.id);
    if (existing?.countryCode) {
      const oldSet = this.countryIndex.get(existing.countryCode);
      oldSet?.delete(station.id);
    }

    // Add to stations
    this.stations.set(station.id, station);

    // Add to country index
    if (station.countryCode) {
      const code = station.countryCode.toUpperCase();
      if (!this.countryIndex.has(code)) {
        this.countryIndex.set(code, new Set());
      }
      this.countryIndex.get(code)!.add(station.id);
    }
  }

  upsertMany(stations: Station[]): void {
    for (const station of stations) {
      this.upsert(station);
    }
    logger.info('StationRepo', `Upserted ${stations.length} stations`);
  }

  insertMany(stations: Station[]): void {
    this.upsertMany(stations);
  }

  delete(id: string): boolean {
    const station = this.stations.get(id);
    if (!station) return false;

    // Remove from country index
    if (station.countryCode) {
      const set = this.countryIndex.get(station.countryCode);
      set?.delete(id);
    }

    this.stations.delete(id);
    return true;
  }

  clear(): void {
    this.stations.clear();
    this.countryIndex.clear();
    logger.info('StationRepo', 'Repository cleared');
  }

  count(): number {
    return this.stations.size;
  }
}

// Singleton instance
export const stationRepository: IStationRepository = new InMemoryStationRepository();
