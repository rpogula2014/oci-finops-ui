import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'summary' },
  {
    path: 'summary',
    loadComponent: () => import('./views/summary/summary.component').then((m) => m.SummaryComponent),
    title: 'CostScope · Executive Summary',
  },
  {
    path: 'explorer',
    loadComponent: () => import('./views/explorer/explorer.component').then((m) => m.ExplorerComponent),
    title: 'CostScope · Cost Explorer',
  },
  {
    path: 'resources',
    loadComponent: () => import('./views/resources/resources.component').then((m) => m.ResourcesComponent),
    title: 'CostScope · Resources',
  },
  {
    path: 'resources/:ocid',
    loadComponent: () =>
      import('./views/resources/resource-detail.component').then((m) => m.ResourceDetailComponent),
    title: 'CostScope · Resource Detail',
  },
  {
    path: 'trends',
    loadComponent: () => import('./views/trends/trends.component').then((m) => m.TrendsComponent),
    title: 'CostScope · Trends',
  },
  { path: '**', redirectTo: 'summary' },
];
