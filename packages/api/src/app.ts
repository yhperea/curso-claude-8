import express from 'express'
import type { Router } from 'express'
import cors from 'cors'
import authRoutes from '@employee/infrastructure/http/auth.routes.js'
import employeeRoutes from '@employee/infrastructure/http/employee.routes.js'
import restaurantEmployeeRoutes from '@employee/infrastructure/http/restaurant-employee.routes.js'
import restaurantRoutes from '@routes/restaurant.routes.js'
import ingredientRoutes from '@routes/ingredient.routes.js'
import dishRoutes from '@routes/dish.routes.js'
import publicRestaurantRoutes from '@routes/restaurant.public.routes.js'
import publicDishRoutes from '@routes/dish.public.routes.js'
import orderRoutes from '@routes/order.routes.js'
import tableRoutes from '@routes/table.routes.js'
import publicTableRoutes from '@routes/table.public.routes.js'
import docsRoutes from '@routes/docs.routes.js'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'

// Routers de negocio, en orden de montaje. Exportado para que el test de
// cobertura de OpenAPI compruebe que todas sus rutas están documentadas.
export const routeMounts: { path: string; router: Router }[] = [
    { path: '/api/v1/orders', router: orderRoutes },
    { path: '/api/v1/auth', router: authRoutes },
    { path: '/api/v1/employees', router: employeeRoutes },
    { path: '/api/v1/public/restaurants', router: publicRestaurantRoutes },
    { path: '/api/v1/public/restaurants/:restaurantId/dishes', router: publicDishRoutes },
    { path: '/api/v1/public/restaurants/:restaurantId/tables', router: publicTableRoutes },
    { path: '/api/v1/restaurants', router: restaurantRoutes },
    { path: '/api/v1/restaurants/:restaurantId/ingredients', router: ingredientRoutes },
    { path: '/api/v1/restaurants/:restaurantId/dishes', router: dishRoutes },
    { path: '/api/v1/restaurants/:restaurantId/tables', router: tableRoutes },
    { path: '/api/v1/restaurants/:restaurantId/employees', router: restaurantEmployeeRoutes }
]

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/v1/docs', docsRoutes)
for (const { path, router } of routeMounts) {
    app.use(path, router)
}

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.use(errorHandler)

export default app
