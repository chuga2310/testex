import { mkdirSync, existsSync } from "fs";
import { ComponentRecord, SearchResult } from "../schema/models.js";

interface Row {
  id: string;
  type: string;
  name: string;
  file: string;
  route: string;
  framework: string;
  data_test_ids: string;
  aria_labels: string;
  user_actions: string;
  raw_text: string;
  vector: number[];
}

function toRow(rec: ComponentRecord, vector: number[]): Row {
  return {
    id: rec.id,
    type: rec.type,
    name: rec.name,
    file: rec.file,
    route: rec.route ?? "",
    framework: rec.framework,
    data_test_ids: JSON.stringify(rec.dataTestIds),
    aria_labels: JSON.stringify(rec.ariaLabels),
    user_actions: JSON.stringify(rec.userActions),
    raw_text: rec.rawText.slice(0, 2000),
    vector,
  };
}

function fromRow(row: Row): ComponentRecord {
  return {
    id: row.id,
    type: row.type,
    framework: row.framework,
    name: row.name,
    route: row.route || null,
    file: row.file,
    dataTestIds: JSON.parse(row.data_test_ids) as string[],
    ariaLabels: JSON.parse(row.aria_labels) as string[],
    relatedApi: [],
    children: [],
    userActions: JSON.parse(row.user_actions) as string[],
    rawText: row.raw_text,
  };
}

const TABLE_NAME = "components";

export class LanceDBStore {
  private db: unknown = null;
  private table: unknown = null;

  constructor(private readonly dbPath: string) {
    if (!existsSync(dbPath)) mkdirSync(dbPath, { recursive: true });
  }

  private async connect(): Promise<void> {
    if (this.db) return;
    const lancedb = await import("@lancedb/lancedb");
    this.db = await lancedb.connect(this.dbPath);
  }

  private async getTable(create = false): Promise<unknown> {
    await this.connect();
    const db = this.db as {
      tableNames(): Promise<string[]>;
      openTable(name: string): Promise<unknown>;
      createTable(name: string, data: Row[]): Promise<unknown>;
    };
    const names = await db.tableNames();
    if (names.includes(TABLE_NAME)) {
      this.table = await db.openTable(TABLE_NAME);
    } else if (create) {
      // Cannot create empty table; caller must provide initial data
      this.table = null;
    }
    return this.table;
  }

  async upsert(records: ComponentRecord[], vectors: number[][]): Promise<number> {
    if (!records.length) return 0;
    await this.connect();
    const db = this.db as {
      tableNames(): Promise<string[]>;
      openTable(name: string): Promise<{
        add(rows: Row[]): Promise<void>;
        delete(where: string): Promise<void>;
      }>;
      createTable(name: string, data: Row[]): Promise<unknown>;
    };
    const rows = records.map((rec, i) => toRow(rec, vectors[i]));
    const names = await db.tableNames();
    if (!names.includes(TABLE_NAME)) {
      this.table = await db.createTable(TABLE_NAME, rows);
    } else {
      const tbl = await db.openTable(TABLE_NAME);
      const ids = rows.map((r) => `'${r.id}'`).join(", ");
      try {
        await tbl.delete(`id IN (${ids})`);
      } catch {
        // ignore if rows don't exist yet
      }
      await tbl.add(rows);
      this.table = tbl;
    }
    return rows.length;
  }

  async search(queryVec: number[], limit = 10): Promise<SearchResult[]> {
    const tbl = await this.getTable() as {
      search(vec: number[]): { limit(n: number): { toArray(): Promise<(Row & { _distance: number })[]> } };
    } | null;
    if (!tbl) return [];
    try {
      const results = await tbl.search(queryVec).limit(limit).toArray();
      return results.map((r) => ({
        record: fromRow(r),
        score: r._distance ?? 0,
      }));
    } catch {
      return [];
    }
  }

  /** Multi-keyword union search: embed each keyword separately, merge by best score. */
  async searchMulti(queryVecs: number[][], limit = 10): Promise<SearchResult[]> {
    const seen = new Map<string, SearchResult>();
    for (const vec of queryVecs) {
      const results = await this.search(vec, limit);
      for (const r of results) {
        const existing = seen.get(r.record.id);
        // keep the best (lowest) distance score
        if (!existing || r.score < existing.score) {
          seen.set(r.record.id, r);
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.score - b.score).slice(0, limit);
  }

  /** AND filter: returns components containing ALL of the given test IDs. */
  async searchByAllTestIds(testIds: string[]): Promise<ComponentRecord[]> {
    if (!testIds.length) return [];
    const tbl = await this.getTable() as {
      query(): { where(cond: string): { toArray(): Promise<Row[]> } };
    } | null;
    if (!tbl) return [];
    try {
      const conditions = testIds
        .map((id) => `data_test_ids LIKE '%${id}%'`)
        .join(" AND ");
      const rows = await tbl.query().where(conditions).toArray();
      return rows.map(fromRow);
    } catch {
      return [];
    }
  }

  async searchByTestId(testId: string): Promise<ComponentRecord[]> {
    const tbl = await this.getTable() as {
      query(): { where(cond: string): { toArray(): Promise<Row[]> } };
    } | null;
    if (!tbl) return [];
    try {
      const rows = await tbl
        .query()
        .where(`data_test_ids LIKE '%${testId}%'`)
        .toArray();
      return rows.map(fromRow);
    } catch {
      return [];
    }
  }

  async getByRoute(route: string): Promise<ComponentRecord[]> {
    const tbl = await this.getTable() as {
      query(): { where(cond: string): { toArray(): Promise<Row[]> } };
    } | null;
    if (!tbl) return [];
    try {
      const rows = await tbl
        .query()
        .where(`route = '${route}'`)
        .toArray();
      return rows.map(fromRow);
    } catch {
      return [];
    }
  }

  async count(): Promise<number> {
    const tbl = await this.getTable() as { countRows(): Promise<number> } | null;
    if (!tbl) return 0;
    try {
      return await tbl.countRows();
    } catch {
      return 0;
    }
  }

  async allTestIds(): Promise<string[]> {
    const tbl = await this.getTable() as {
      query(): { select(cols: string[]): { toArray(): Promise<{ data_test_ids: string }[]> } };
    } | null;
    if (!tbl) return [];
    try {
      const rows = await tbl.query().select(["data_test_ids"]).toArray();
      const ids: string[] = [];
      for (const row of rows) {
        ids.push(...(JSON.parse(row.data_test_ids) as string[]));
      }
      return [...new Set(ids)];
    } catch {
      return [];
    }
  }

  async drop(): Promise<void> {
    await this.connect();
    const db = this.db as {
      tableNames(): Promise<string[]>;
      dropTable(name: string): Promise<void>;
    };
    const names = await db.tableNames();
    if (names.includes(TABLE_NAME)) {
      await db.dropTable(TABLE_NAME);
    }
    this.table = null;
  }
}
