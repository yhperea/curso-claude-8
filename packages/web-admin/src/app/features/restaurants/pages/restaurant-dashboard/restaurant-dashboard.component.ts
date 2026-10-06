import { Component, computed, inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { map, of } from 'rxjs'
import { LucideAngularModule } from 'lucide-angular'
import { RestaurantStore } from '../../store/restaurant.store'

@Component({
  selector: 'app-restaurant-dashboard',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './restaurant-dashboard.component.html',
  styleUrl: './restaurant-dashboard.component.css'
})
export class RestaurantDashboardComponent {
  private readonly route = inject(ActivatedRoute)
  private readonly restaurantStore = inject(RestaurantStore)

  // El componente se reutiliza al cambiar de restaurante: hay que reaccionar a cada cambio de :restaurantId
  readonly restaurantId = toSignal<string, string>(
    this.route.parent?.paramMap.pipe(map(params => params.get('restaurantId') ?? '')) ?? of(''),
    { initialValue: '' }
  )
  readonly restaurantName = computed(() =>
    this.restaurantStore.getById(this.restaurantId())?.name ?? 'Restaurante'
  )
}
