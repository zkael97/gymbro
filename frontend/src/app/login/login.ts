import { Component } from '@angular/core';
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

  constructor(
    private router: Router,
    private auth: AuthService,
    private firebaseService: FirebaseService
  ) {}

  async onSubmit() {
    this.errorMessage = '';
    try {
      const response = await this.firebaseService.login(this.username, this.password);
      this.auth.setUser(response.user.username, response.token);
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMessage = err.message || 'Login failed';
    }
  }
}
