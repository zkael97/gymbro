import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Register } from './register/register';
import { ForgotPassword } from './forgot-password/forgot-password';
import { Home } from './home/home';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];

