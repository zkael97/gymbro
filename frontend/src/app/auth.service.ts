import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

  setUser(username: string, token: string): void {
    localStorage.setItem('gymbro_username', username);
    localStorage.setItem('gymbro_token', token);
    localStorage.setItem('gymbro_login_time', Date.now().toString());
  }

  getUsername(): string | null {
    if (!this.isLoggedIn()) {
      return null;
    }
    return localStorage.getItem('gymbro_username');
  }

  getToken(): string | null {
    if (!this.isLoggedIn()) {
      return null;
    }
    return localStorage.getItem('gymbro_token');
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('gymbro_token');
    const loginTimeStr = localStorage.getItem('gymbro_login_time');

    if (!token) {
      return false;
    }

    // Jika tidak ada catatan waktu login atau sudah lewat 6 jam, anggap expired dan bersihkan session
    if (!loginTimeStr) {
      this.clearUser();
      return false;
    }

    const loginTime = parseInt(loginTimeStr, 10);
    const now = Date.now();

    if (isNaN(loginTime) || (now - loginTime) > this.SESSION_DURATION_MS) {
      this.clearUser();
      return false;
    }

    return true;
  }

  clearUser(): void {
    localStorage.removeItem('gymbro_username');
    localStorage.removeItem('gymbro_token');
    localStorage.removeItem('gymbro_login_time');
  }
}
