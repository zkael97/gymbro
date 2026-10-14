import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

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
    private http: HttpClient,
    private router: Router,
    private auth: AuthService
  ) {}

  onSubmit() {
    this.http.post<any>(`${environment.apiUrl}/api/login`, {
      username: this.username,
      password: this.password
    }).subscribe({
      next: (response) => {
        this.auth.setUser(response.user.username, response.token);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Login failed';
      }
    });
  }
}
