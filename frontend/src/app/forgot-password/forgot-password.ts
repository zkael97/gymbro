import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  username = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  loading = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.username.trim() || !this.newPassword) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.loading = true;
    this.http.post<any>(`${environment.apiUrl}/api/forgot-password`, {
      username: this.username,
      newPassword: this.newPassword
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message || 'Password reset successfully! Redirecting to login...';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Failed to reset password';
      }
    });
  }
}
