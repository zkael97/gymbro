import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FirebaseService } from '../firebase.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  username = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';

  constructor(
    private router: Router,
    private firebaseService: FirebaseService
  ) {}

  async onSubmit() {
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.errorMessage = '';
    try {
      const response = await this.firebaseService.register(this.username, this.password);
      alert(response.message);
      this.router.navigate(['/login']);
    } catch (err: any) {
      this.errorMessage = err.message || 'Registration failed';
    }
  }
}
