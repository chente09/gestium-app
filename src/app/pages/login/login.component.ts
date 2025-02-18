import { Component } from '@angular/core';
import {NzFormModule} from 'ng-zorro-antd/form';
import {NzInputModule} from 'ng-zorro-antd/input';
import {NzButtonModule} from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { RegistersService } from '../../services/registers/registers.service';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { getAuth, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { NzCardModule } from 'ng-zorro-antd/card';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NzFormModule, 
    NzInputModule, 
    NzButtonModule, 
    ReactiveFormsModule, 
    NzCheckboxModule, 
    NzIconModule,
    NzCardModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  form: FormGroup;
  registerForm: FormGroup;
  isRegistering = false;

  constructor(
    private registerService: RegistersService, 
    private formBuilder: FormBuilder,
    private router: Router,
    private message: NzMessageService
  ) { 
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email, this.emailGestiumValidator]],
      password: ['', Validators.required]
    });

    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email, this.emailGestiumValidator]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.checkRedirectResult();
  }

  // Verifica si hay un usuario después de la redirección
checkRedirectResult(): void {
  const auth = getAuth();
  getRedirectResult(auth)
    .then(response => {
      if (response) {
        this.handleGoogleLogin(response);
      }
    })
    .catch(error => this.handleGoogleError(error));
}
  emailGestiumValidator(control: AbstractControl): ValidationErrors | null {
    const email = control.value?.trim();
    return email && email.includes('gestium') ? null : { gestiumEmail: true };
  }

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onClickLogin(): void {
    if (this.form.invalid) {
      this.message.warning('Por favor, complete todos los campos correctamente.');
      return;
    }

    this.registerService.login(this.form.value)
      .then((response) => {
        if (response) {
          this.message.success('Inicio de sesión exitoso.');
          this.router.navigate(['/welcome']);
          this.resetForms();
        } else {
          this.message.error('No se pudo iniciar sesión. Verifique sus credenciales.');
        }
      })
      .catch((error) => {
        console.log(error);
        this.message.error('Ocurrió un error al iniciar sesión.');
      });
  }   

  onClickRegister(): void {
    if (this.registerForm.invalid) {
      this.message.warning('Por favor, complete todos los campos correctamente.');
      return;
    }
    
    const { email, password } = this.registerForm.value;
    this.registerService.createRegister(
      { email, password }, // Primer argumento: credenciales
      { 
        email, 
        nickname: 'UsuarioNuevo',  // Puedes modificar esto para obtenerlo del formulario
        photoURL: '',  // Opcional
        phoneNumber: '',  // Opcional
        role: 'Empleado' // Puedes establecer el rol por defecto o pedirlo en el formulario
      }
    )
    .then(() => {
      this.message.success('Registro exitoso. Ahora puede iniciar sesión.');
      this.isRegistering = false;
      this.resetForms();
    })
    .catch((error) => {
      console.log(error);
      this.message.error('Ocurrió un error durante el registro.');
    });
  }

  onClickLoginGoogle(): void {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
  
    if (window.location.hostname === 'localhost') {
      // Usa signInWithPopup en desarrollo
      signInWithPopup(auth, provider)
        .then(response => this.handleGoogleLogin(response))
        .catch(error => this.handleGoogleError(error));
    } else {
      // Usa signInWithRedirect en producción
      signInWithRedirect(auth, provider);
    }
  }
  
  // Maneja la respuesta del login
  handleGoogleLogin(response: any): void {
    const userEmail = response.user.email?.trim();
    console.log("Correo del usuario:", userEmail);
  
    if (userEmail && userEmail.includes('gestium') && userEmail.includes('@gmail.com')) {
      this.message.success('Inicio de sesión con Google exitoso.');
      this.router.navigate(['/welcome']);
      this.resetForms();
    } else {
      this.message.warning('Solo los correos autorizados pueden iniciar sesión.');
      this.registerService.logout();
      this.resetForms();
    }
  }
  
  // Maneja errores del login
  handleGoogleError(error: any): void {
    console.log("Error al iniciar sesión con Google:", error);
    this.message.error('Error al intentar iniciar sesión con Google.');
  }
  
  
  toggleRegister(): void {
    this.isRegistering = !this.isRegistering;
  }
  
  resetForms(): void {
    this.form.reset();
    this.registerForm.reset();
  }
}


