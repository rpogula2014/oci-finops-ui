import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'summary' },
  {
    path: 'summary',
    loadComponent: () => import('./views/summary/summary.component').then((m) => m.SummaryComponent),
    title: 'ATD FinOps · Cost Summary',
  },
  {
    path: 'explorer',
    loadComponent: () => import('./views/explorer/explorer.component').then((m) => m.ExplorerComponent),
    title: 'ATD FinOps · Cost Explorer',
  },
  {
    path: 'resources',
    loadComponent: () => import('./views/resources/resources.component').then((m) => m.ResourcesComponent),
    title: 'ATD FinOps · Resources',
  },
  {
    path: 'resources/:ocid',
    loadComponent: () =>
      import('./views/resources/resource-detail.component').then((m) => m.ResourceDetailComponent),
    title: 'ATD FinOps · Resource Detail',
  },
  {
    path: 'trends',
    loadComponent: () => import('./views/trends/trends.component').then((m) => m.TrendsComponent),
    title: 'ATD FinOps · Trends',
  },
  { path: '**', redirectTo: 'summary' },
];
