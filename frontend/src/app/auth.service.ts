import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  setUser(username: string, token: string): void {
    localStorage.setItem('gymbro_username', username);
    localStorage.setItem('gymbro_token', token);
  }

  getUsername(): string | null {
    return localStorage.getItem('gymbro_username');
  }

  getToken(): string | null {
    return localStorage.getItem('gymbro_token');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('gymbro_token');
  }

  clearUser(): void {
    localStorage.removeItem('gymbro_username');
    localStorage.removeItem('gymbro_token');
  }
}
