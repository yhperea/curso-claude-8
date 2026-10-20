import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Table, TableStatus } from '../models/table.model';
import { Order } from '../../orders/models/order.model';
import { TableService } from '../services/table.service';

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _selectedTableId = signal<string | null>(null);
  private readonly _selectedOrders = signal<Order[]>([]);
  private readonly _ordersLoading = signal(false);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedOrders = this._selectedOrders.asReadonly();
  readonly ordersLoading = this._ordersLoading.asReadonly();

  readonly selectedTable = computed(() =>
    this._tables().find(table => table.id === this._selectedTableId()) ?? null
  );

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const tables = await firstValueFrom(this.tableService.getTables(restaurantId));
      this._tables.set(tables);
    } catch (err: any) {
      this._error.set(this.errorMessage(err, 'Error al cargar mesas'));
    } finally {
      this._loading.set(false);
    }
  }

  async updateStatus(restaurantId: string, tableId: string, status: TableStatus): Promise<void> {
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.tableService.updateStatus(restaurantId, tableId, { status }));
      this._tables.update(tables => tables.map(table => table.id === tableId ? updated : table));
      if (this._selectedTableId() === tableId) {
        await this.loadSelectedOrders(restaurantId);
      }
    } catch (err: any) {
      this._error.set(this.errorMessage(err, 'Error al cambiar el estado de la mesa'));
    }
  }

  async selectTable(restaurantId: string, tableId: string | null): Promise<void> {
    this._selectedTableId.set(tableId);
    this._selectedOrders.set([]);
    await this.loadSelectedOrders(restaurantId);
  }

  private async loadSelectedOrders(restaurantId: string): Promise<void> {
    const table = this.selectedTable();
    if (!table || table.status !== 'ocupada') {
      this._selectedOrders.set([]);
      return;
    }
    this._ordersLoading.set(true);
    try {
      const orders = await firstValueFrom(this.tableService.getTableOrders(restaurantId, table.id));
      this._selectedOrders.set(orders);
    } catch (err: any) {
      this._error.set(this.errorMessage(err, 'Error al cargar los pedidos de la mesa'));
    } finally {
      this._ordersLoading.set(false);
    }
  }

  startPolling(restaurantId: string): void {
    const refresh = async () => {
      await this.loadTables(restaurantId);
      await this.loadSelectedOrders(restaurantId);
    };
    refresh();
    this.pollingInterval = setInterval(refresh, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private errorMessage(err: any, fallback: string): string {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }
}
