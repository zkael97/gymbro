import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { FirebaseService } from '../firebase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  username = '';
  password = '';
  errorMessage = '';
  showPassword = false;
  isLoading = false;

  constructor(
    private router: Router,
    private auth: AuthService,
    private firebaseService: FirebaseService,
    private cdr: ChangeDetectorRef
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;
    try {
      const response = await this.firebaseService.login(this.username, this.password);
      this.auth.setUser(response.user.username, response.token);
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMessage = err.message || 'Login failed';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }
}
