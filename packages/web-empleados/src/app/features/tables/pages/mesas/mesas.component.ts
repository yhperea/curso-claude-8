import { Component, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { Table, TableStatus, TABLE_STATUSES } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [DatePipe, LucideAngularModule],
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);

  readonly statuses = TABLE_STATUSES;

  readonly counts = computed(() => {
    const tables = this.tableStore.tables();
    return {
      libre: tables.filter(t => t.status === 'libre').length,
      ocupada: tables.filter(t => t.status === 'ocupada').length,
      reservada: tables.filter(t => t.status === 'reservada').length
    };
  });

  private get restaurantId(): string | undefined {
    return this.authStore.user()?.restaurantId;
  }

  ngOnInit(): void {
    if (this.restaurantId) {
      this.tableStore.startPolling(this.restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
  }

  select(table: Table): void {
    if (!this.restaurantId) return;
    const isSelected = this.tableStore.selectedTable()?.id === table.id;
    this.tableStore.selectTable(this.restaurantId, isSelected ? null : table.id);
  }

  changeStatus(table: Table, status: TableStatus, event: Event): void {
    event.stopPropagation();
    if (!this.restaurantId || table.status === status) return;
    this.tableStore.updateStatus(this.restaurantId, table.id, status);
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }
}
