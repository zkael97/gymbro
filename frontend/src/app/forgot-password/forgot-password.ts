import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FirebaseService } from '../firebase.service';

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
    private router: Router,
    private firebaseService: FirebaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async onSubmit() {
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
    try {
      const response = await this.firebaseService.forgotPassword(this.username, this.newPassword);
      this.loading = false;
      this.successMessage = response.message || 'Password reset successfully! Redirecting to login...';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } catch (err: any) {
      this.loading = false;
      this.errorMessage = err.message || 'Failed to reset password';
      this.cdr.markForCheck();
    }
  }
}
