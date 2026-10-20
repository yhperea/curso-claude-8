import { Component, computed, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { HttpErrorResponse } from '@angular/common/http'
import { LucideAngularModule } from 'lucide-angular'
import { RestaurantService } from '../../core/services/restaurant.service'
import { TableService } from '../../core/services/table.service'
import { CartStore } from '../../core/store/cart.store'
import { Restaurant } from '../../core/models/restaurant.model'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink, FormsModule, LucideAngularModule],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>{{ restaurant()?.name || 'Cargando...' }}</h1>
        </div>
      </div>

      @if (currentTable(); as current) {
        <div class="current-table card">
          <span>
            Ya tienes la <strong>mesa {{ current.table.number }}</strong> para
            {{ current.people }} {{ current.people === 1 ? 'persona' : 'personas' }}.
          </span>
          <a [routerLink]="['/restaurants', restaurantId]" class="btn btn-primary btn-sm">
            Continuar a la carta
          </a>
        </div>
      } @else {
        <form class="people-step card" (ngSubmit)="searchTables()">
          <div class="form-group">
            <label for="people">¿Cuántas personas sois?</label>
            <div class="people-row">
              <lucide-icon name="users" [size]="20"></lucide-icon>
              <input
                id="people"
                name="people"
                type="number"
                min="1"
                class="form-control"
                [(ngModel)]="people"
              />
              <button type="submit" class="btn btn-primary" [disabled]="loading()">
                Ver mesas disponibles
              </button>
            </div>
          </div>
        </form>

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        @if (loading()) {
          <div class="spinner"></div>
        } @else if (searched()) {
          @if (tables().length === 0) {
            <div class="empty-state card">
              <p>No hay mesas libres para {{ searchedPeople() }} personas en este momento</p>
            </div>
          } @else {
            <div class="table-grid">
              @for (table of tables(); track table.id) {
                <button
                  type="button"
                  class="table-card card"
                  [class.selected]="selectedId() === table.id"
                  (click)="selectedId.set(table.id)"
                >
                  <lucide-icon name="armchair" [size]="28"></lucide-icon>
                  <span class="table-number">Mesa {{ table.number }}</span>
                  <span class="table-capacity">Hasta {{ table.capacity }} personas</span>
                  @if (table.description) {
                    <span class="table-description">{{ table.description }}</span>
                  }
                </button>
              }
            </div>

            <div class="actions">
              <button
                class="btn btn-primary"
                [disabled]="!selectedId() || occupying()"
                (click)="continue()"
              >
                {{ occupying() ? 'Reservando mesa...' : 'Continuar' }}
              </button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .container {
        max-width: 900px;
        margin: 0 auto;
      }
      .back-link {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 8px;
        display: inline-block;
      }
      .current-table {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 16px 20px;
        margin-bottom: 16px;
        border-color: var(--green-medium);
      }
      .people-step {
        margin-bottom: 24px;
      }
      .people-row {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--green-light);
      }
      .people-row input {
        width: 100px;
      }
      .table-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
      }
      .table-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 20px;
        color: var(--text-primary);
        cursor: pointer;
        transition: all var(--transition);
      }
      .table-card:hover {
        border-color: var(--green-medium);
      }
      .table-card.selected {
        border-color: var(--green-light);
        box-shadow: var(--shadow-glow);
        background: var(--green-glow);
      }
      .table-card lucide-icon {
        color: var(--green-light);
      }
      .table-number {
        font-size: 16px;
        font-weight: 600;
      }
      .table-capacity {
        font-size: 13px;
        color: var(--text-secondary);
      }
      .table-description {
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 24px;
      }
    `
  ]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly restaurantService = inject(RestaurantService)
  private readonly tableService = inject(TableService)
  readonly cartStore = inject(CartStore)

  restaurantId = ''
  people = 2

  readonly restaurant = signal<Restaurant | null>(null)
  // Solo se permite una mesa por restaurante: si ya la tiene, no puede ocupar otra
  readonly currentTable = computed(() => {
    const current = this.cartStore.selectedTable()
    return current?.table.restaurantId === this.restaurantId ? current : null
  })
  readonly tables = signal<Table[]>([])
  readonly selectedId = signal<string | null>(null)
  readonly searchedPeople = signal(0)
  readonly searched = signal(false)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly error = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    this.restaurantService.getById(this.restaurantId).subscribe({
      next: restaurant => this.restaurant.set(restaurant),
      error: () => {}
    })
  }

  searchTables(): void {
    const people = Number(this.people)
    if (!Number.isInteger(people) || people < 1) {
      this.error.set('Indica un número de personas válido')
      return
    }
    this.error.set(null)
    this.loadTables(people)
  }

  continue(): void {
    const tableId = this.selectedId()
    const people = this.searchedPeople()
    if (!tableId || this.currentTable()) return

    this.occupying.set(true)
    this.error.set(null)

    this.tableService.occupy(this.restaurantId, tableId, people).subscribe({
      next: table => {
        this.cartStore.setTable(table, people)
        this.occupying.set(false)
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        if (err.status === 409 || err.status === 404) {
          this.error.set('Esa mesa acaba de dejar de estar disponible. Elige otra.')
          this.loadTables(people)
        } else if (err.error?.error === 'TableCapacityExceededError') {
          this.error.set('La mesa no tiene capacidad suficiente. Elige otra.')
        } else {
          this.error.set('No se ha podido reservar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }

  private loadTables(people: number): void {
    this.loading.set(true)
    this.selectedId.set(null)
    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: tables => {
        this.tables.set(tables)
        this.searchedPeople.set(people)
        this.searched.set(true)
        this.loading.set(false)
      },
      error: () => {
        this.error.set('Error al cargar las mesas disponibles')
        this.loading.set(false)
      }
    })
  }
}
