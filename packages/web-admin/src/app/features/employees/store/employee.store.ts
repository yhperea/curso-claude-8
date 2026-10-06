import { Injectable, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { EmployeeService } from '../services/employee.service'
import type { Employee, CreateEmployeeDto } from '../models/employee.model'

@Injectable({ providedIn: 'root' })
export class EmployeeStore {
  private readonly service = inject(EmployeeService)

  private readonly _employees = signal<Employee[]>([])
  private readonly _loading = signal(false)
  private readonly _error = signal<string | null>(null)
  private _currentRestaurantId: string | null = null

  readonly employees = this._employees.asReadonly()
  readonly loading = this._loading.asReadonly()
  readonly error = this._error.asReadonly()

  async loadAll(): Promise<void> {
    this._currentRestaurantId = null
    this._loading.set(true)
    this._error.set(null)
    try {
      const data = await firstValueFrom(this.service.getAll())
      this._employees.set(data)
    } catch {
      this._error.set('No se pudieron cargar los empleados.')
    } finally {
      this._loading.set(false)
    }
  }

  async loadByRestaurant(restaurantId: string): Promise<void> {
    // Al cambiar de restaurante no se deben seguir mostrando los datos del anterior
    if (this._currentRestaurantId !== restaurantId) {
      this._employees.set([])
    }
    this._currentRestaurantId = restaurantId
    this._loading.set(true)
    this._error.set(null)
    try {
      const data = await firstValueFrom(this.service.getByRestaurant(restaurantId))
      // Descarta respuestas de un restaurante que ya no es el actual
      if (this._currentRestaurantId !== restaurantId) return
      this._employees.set(data)
    } catch {
      if (this._currentRestaurantId !== restaurantId) return
      this._error.set('No se pudieron cargar los empleados.')
    } finally {
      if (this._currentRestaurantId === restaurantId) this._loading.set(false)
    }
  }

  async create(dto: CreateEmployeeDto): Promise<void> {
    const employee = await firstValueFrom(this.service.create(dto))
    this._employees.update(list => [...list, employee])
  }
}
