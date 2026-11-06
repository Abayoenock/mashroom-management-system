import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AppLayout, RequireRole } from '@/components/layout/AppLayout'
import { LandingPage } from '@/features/landing/LandingPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from '@/features/auth/AuthPages'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { FarmsPage, RoomsPage, VarietiesPage } from '@/features/farms/FarmPages'
import { BatchDetailPage, ProductionPage } from '@/features/production/ProductionPages'
import { HarvestsPage } from '@/features/harvests/HarvestsPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { NewSalePage, SaleDetailPage, SalesPage } from '@/features/sales/SalesPages'
import { CustomersPage } from '@/features/sales/CustomersPage'
import { ExpensesPage } from '@/features/finance/ExpensesPage'
import { EmployeesPage, TasksPage, UsersPage } from '@/features/team/TeamPages'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ProfilePage } from '@/features/settings/ProfilePage'
import { OrganizationsPage } from '@/features/organizations/OrganizationsPage'

const M = ['super_admin', 'farm_owner', 'farm_manager']
const S = ['super_admin', 'farm_owner', 'sales_manager', 'farm_manager']
const guard = (roles: string[], el: React.ReactNode) => <RequireRole roles={roles}>{el}</RequireRole>

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'organizations', element: guard(['super_admin'], <OrganizationsPage />) },
      { path: 'farms', element: <FarmsPage /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'varieties', element: <VarietiesPage /> },
      { path: 'production', element: <ProductionPage /> },
      { path: 'production/:id', element: <BatchDetailPage /> },
      { path: 'harvests', element: <HarvestsPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'sales', element: guard(S, <SalesPage />) },
      { path: 'sales/new', element: guard(S, <NewSalePage />) },
      { path: 'sales/:id', element: guard(S, <SaleDetailPage />) },
      { path: 'customers', element: guard(S, <CustomersPage />) },
      { path: 'expenses', element: guard(M, <ExpensesPage />) },
      { path: 'reports', element: guard([...M, 'sales_manager'], <ReportsPage />) },
      { path: 'employees', element: guard(M, <EmployeesPage />) },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'users', element: guard(['super_admin', 'farm_owner'], <UsersPage />) },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
